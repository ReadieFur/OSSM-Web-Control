#!/usr/bin/env python3
import json
import os
import sys
import tempfile
from io import StringIO

# Add the script's own directory to sys.path so sibling modules can be imported directly
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

import diff_checker
import compile_firmware

def main():
    # Ensure we are running from the repository root
    repo_root = os.path.abspath(os.path.join(script_dir, "../../"))
    os.chdir(repo_root)
    print(f"Working directory set to repo root: {repo_root}")

    print("Running firmware diff checker (diff_checker.main())...")

    # Create a temporary file to emulate GITHUB_OUTPUT locally
    temp_output = tempfile.NamedTemporaryFile(mode='w+', delete=False)
    temp_output_path = temp_output.name
    temp_output.close()

    # Pass GITHUB_OUTPUT in the environment
    os.environ["GITHUB_OUTPUT"] = temp_output_path

    payload = None
    try:
        # Capture stdout to fallback if needed while calling diff_checker.main()
        old_stdout = sys.stdout
        captured_stdout = StringIO()
        sys.stdout = captured_stdout

        try:
            diff_checker.main()
        except SystemExit as e:
            if e.code is not None and e.code != 0:
                raise RuntimeError(f"diff_checker.main() exited with code {e.code}")
        finally:
            sys.stdout = old_stdout

        diff_output_text = captured_stdout.getvalue()

        # Read the emulated GITHUB_OUTPUT file to extract the payload
        if os.path.exists(temp_output_path):
            with open(temp_output_path, 'r') as f:
                for line in f:
                    if line.startswith("firmwares_payload="):
                        json_str = line.split("=", 1)[1].strip()
                        payload = json.loads(json_str)
                        break

        # Fallback to parsing captured stdout if GITHUB_OUTPUT wasn't written to
        if not payload and diff_output_text.strip():
            try:
                payload = json.loads(diff_output_text)
            except json.JSONDecodeError:
                pass

    finally:
        if os.path.exists(temp_output_path):
            os.remove(temp_output_path)

    if not payload:
        print("Failed to retrieve firmware payload from diff checker.", file=sys.stderr)
        sys.exit(1)

    compile_list = payload.get("compile", [])
    
    if not compile_list:
        print("No firmware updates detected. Nothing to compile.")
        sys.exit(0)

    print(f"Detected {len(compile_list)} firmware target(s) to compile sequentially:")
    for target in compile_list:
        print(f"  - {target}")

    # Sequentially iterate and compile each target directly in-process.
    # Fails fast on the first error and re-raises so your debugger catches it live.
    for target in compile_list:
        print(f"\n--- Starting build for: {target} ---")
        try:
            compile_firmware.compile_firmware(target)
        except Exception as e:
            print(f"Build failed for target: {target}: {e}", file=sys.stderr)
            raise  # Rethrow so the debugger traps the exception live

    print("\nAll firmware builds completed successfully.")

if __name__ == "__main__":
    main()