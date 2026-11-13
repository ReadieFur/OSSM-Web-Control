#!/usr/bin/env python3
import subprocess
import json
import os
import sys

JSON_PATH = "src/lib/assets/firmwares.json"

def run_cmd(cmd, check=True):
    print("> " + ' '.join(cmd))
    # Let stdout and stderr inherit directly so git/pio stay unbuffered and stream live
    result = subprocess.run(cmd, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command {' '.join(cmd)} failed with exit code {result.returncode}")
    return result

def get_base_json():
    is_gha = os.environ.get("GITHUB_ACTIONS") == "true"
    event_name = os.environ.get("GITHUB_EVENT_NAME")
    base_rev = "HEAD" if os.environ.get('ACT') else "HEAD~1"

    try:
        # Determine comparison baseline based on execution context
        if is_gha and event_name == "pull_request":
            run_cmd(["git", "fetch", "origin", "main"], check=False)
            base_rev = "origin/main"
        elif is_gha and event_name == "push":
            event_path = os.environ.get("GITHUB_EVENT_PATH")
            if event_path and os.path.exists(event_path):
                with open(event_path, 'r') as f:
                    event_data = json.load(f)
                before_sha = event_data.get("before")
                if before_sha and before_sha != "0000000000000000000000000000000000000000":
                    base_rev = before_sha
            if not base_rev:
                base_rev = "HEAD"
        else:
            base_rev = "HEAD"

        result = run_cmd(["git", "show", f"{base_rev}:{JSON_PATH}"], check=True)
        return json.loads(result.stdout)
    except Exception:
        return None

def main():
    if not os.path.exists(JSON_PATH):
        exit(1)

    # Load current firmware configuration dictionary
    with open(JSON_PATH, 'r') as f:
        current_data = json.load(f)

    # Retrieve baseline dictionary for comparison
    base_data = get_base_json() or {}

    compile_list = []
    cache_list = []

    # Compare current key-value pairs against baseline, keeping only string values
    for name, repo_ref in current_data.items():
        if name not in base_data or base_data[name] != repo_ref:
            compile_list.append(repo_ref)
        else:
            cache_list.append(repo_ref)

    result_payload = {
        "compile": compile_list,
        "cache": cache_list
    }

    # Output formatted JSON to console for readable logs
    print("firmware diff result" + json.dumps(result_payload, indent=2))

    # Pass unformatted single-line JSON directly to GitHub Actions outputs
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, 'a') as f:
            f.write(f"firmwares_payload={json.dumps(result_payload)}\n")

if __name__ == "__main__":
    main()
