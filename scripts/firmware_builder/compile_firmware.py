#!/usr/bin/env python3
import glob
import subprocess
import json
import os
import re
import shutil
import sys
import tempfile

def run_cmd(cmd, check=True):
    print("> " + ' '.join(cmd))
    result = subprocess.run(cmd, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command {' '.join(cmd)} failed with exit code {result.returncode}")
    return result

def compile_firmware(repo_ref):
    # Regex pattern for: [author]/[repo]#[sha]</path><#pio_environment>
    pattern = r"^([^#]+)#([^/#]+)(?:/([^#]+))?(?:#(.+))?$"
    match = re.match(pattern, repo_ref)
    
    if not match:
        raise RuntimeError(f"Invalid firmware reference format: '{repo_ref}'")

    repo_slug, ref, subpath, pio_env = match.groups()
    subpath = subpath or ""

    repo_url = f"https://github.com/{repo_slug}.git"
    root_dir = os.getcwd()

    # Construct a named temp directory based on the sanitized reference string
    safe_name = re.sub(r"[/#]", "_", repo_ref)
    build_dir = os.path.join(tempfile.gettempdir(), safe_name)

    # Check if git is already initialized and matches upstream
    is_valid_repo = False
    if os.path.isdir(build_dir) and os.path.isdir(os.path.join(build_dir, ".git")):
        res = subprocess.run(["git", "-C", build_dir, "remote", "get-url", "origin"], capture_output=True, text=True)
        if res.returncode == 0 and res.stdout.strip() == repo_url:
            is_valid_repo = True

    if is_valid_repo:
        print(f"Using cached repository at {build_dir}")
        run_cmd(["git", "-C", build_dir, "fetch", "origin"])
    else:
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
        print(f"Cloning repository recursively to {build_dir}")
        run_cmd(["git", "clone", "--recursive", repo_url, build_dir])

    os.chdir(build_dir)
    try:
        # Checkout the specific commit SHA or ref and update submodules
        run_cmd(["git", "checkout", ref])
        run_cmd(["git", "submodule", "update", "--init", "--recursive"])

        # Navigate into the optional PlatformIO working directory if specified
        if subpath:
            target_work_dir = os.path.join(build_dir, subpath)
            if not os.path.exists(target_work_dir):
                raise RuntimeError(f"Specified subpath '{subpath}' does not exist in repository {repo_slug}")
            os.chdir(target_work_dir)

        # Construct pio command strictly using environment selection without target overrides
        pio_cmd = ["pio", "run"]
        if pio_env:
            pio_cmd.extend(["--environment", pio_env])

        # Execute build step
        run_cmd(pio_cmd)

        if os.environ.get("GITHUB_ACTIONS") == "true":
            build_output_dir = os.path.join(root_dir, "build")
        else:
            build_output_dir = os.path.join(root_dir, "build", "firmwares", safe_name)

        if os.path.exists(build_output_dir):
            shutil.rmtree(build_output_dir)
        os.makedirs(build_output_dir, exist_ok=True)

        bin_files = glob.glob(".pio/build/**/*.bin", recursive=True)
        if not bin_files:
            raise RuntimeError(f"Build completed for {repo_ref}, but no .bin files were found in output.")

        print(f"\nCollecting firmware binaries for '{safe_name}':")
        for bin_path in bin_files:
            filename = os.path.basename(bin_path)
            
            # Skip spurious CMake test binaries
            if "CMakeDetermineCompilerABI" in filename:
                continue

            dest_path = os.path.join(build_output_dir, filename)
            shutil.copy2(bin_path, dest_path)
            print(f"  - Saved {filename} -> {dest_path}")
    finally:
        os.chdir(root_dir)

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else None

    if target:
        compile_firmware(target)
        exit(0)

    payload_raw = os.environ.get("FIRMWARES_PAYLOAD")
    if not payload_raw and not sys.stdin.isatty():
        payload_raw = sys.stdin.read()

    if not payload_raw:
        exit(0)

    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError as e:
        print(f"Failed to parse input payload: {e}", file=sys.stderr)
        exit(1)

    for repo_ref in payload.get("compile", []):
        compile_firmware(repo_ref)

if __name__ == "__main__":
    main()