#!/usr/bin/env python3
"""
Test script to diagnose Claude project directory discovery issues.
Checks various paths where Claude directories might exist.
"""

import os
import platform
import subprocess
import sys
from pathlib import Path


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def run_command(cmd):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return (
            result.stdout.strip()
            if result.returncode == 0
            else f"Error: {result.stderr}"
        )
    except Exception as e:
        return f"Exception: {str(e)}"


def check_path_exists(path):
    """Check if a path exists and return details"""
    path_obj = Path(path)
    info = {
        "path": str(path),
        "exists": path_obj.exists(),
        "is_dir": path_obj.is_dir() if path_obj.exists() else False,
        "is_file": path_obj.is_file() if path_obj.exists() else False,
        "is_symlink": path_obj.is_symlink() if path_obj.exists() else False,
    }

    if path_obj.exists() and path_obj.is_dir():
        try:
            info["contents"] = sorted([p.name for p in path_obj.iterdir()])[
                :10
            ]  # First 10 items
            info["num_items"] = len(list(path_obj.iterdir()))
        except PermissionError:
            info["contents"] = "Permission denied"
            info["num_items"] = -1

    return info


def find_claude_directories(base_paths):
    """Search for Claude-related directories"""
    claude_dirs = []
    claude_patterns = [
        ".claude",
        "claude",
        "Claude",
        ".Claude",
        "claude-projects",
        ".claude-projects",
    ]

    for base in base_paths:
        base_path = Path(base)
        if not base_path.exists():
            continue

        # Check direct paths
        for pattern in claude_patterns:
            test_path = base_path / pattern
            if test_path.exists():
                claude_dirs.append(str(test_path))

        # Search one level deep
        try:
            for item in base_path.iterdir():
                if item.is_dir() and any(
                    pattern in item.name for pattern in claude_patterns
                ):
                    claude_dirs.append(str(item))
        except PermissionError:
            pass

    return claude_dirs


def main():
    print_section("System Information")
    print(f"Platform: {platform.system()}")
    print(f"Python: {sys.version}")
    print(f"Current Working Directory: {os.getcwd()}")
    print(f"Script Location: {os.path.abspath(__file__)}")

    # Environment variables
    print_section("Environment Variables")
    env_vars = [
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
    ]
    for var in env_vars:
        value = os.environ.get(var, "Not set")
        print(f"{var}: {value}")

    # User information
    print_section("User Information")
    print(f"Current User: {run_command('whoami')}")
    print(f"User ID: {run_command('id -u')}")
    print(f"Groups: {run_command('id -G')}")

    # Define paths to check
    print_section("Checking Common Claude Paths")

    # Build list of paths to check
    paths_to_check = []

    # Linux/WSL paths
    if os.environ.get("HOME"):
        home = os.environ["HOME"]
        paths_to_check.extend(
            [
                f"{home}/.claude",
                f"{home}/.config/claude",
                f"{home}/.local/share/claude",
                f"{home}/.claude/projects",
                f"{home}/claude-projects",
            ]
        )

    # Windows paths (if in WSL)
    if platform.system() == "Linux" and "microsoft" in platform.release().lower():
        # Try to find Windows home
        win_user = run_command('cmd.exe /c "echo %USERNAME%" 2>/dev/null').strip()
        if win_user and not win_user.startswith("Error"):
            paths_to_check.extend(
                [
                    f"/mnt/c/Users/{win_user}/.claude",
                    f"/mnt/c/Users/{win_user}/AppData/Roaming/Claude",
                    f"/mnt/c/Users/{win_user}/AppData/Local/Claude",
                    f"/mnt/c/Users/{win_user}/Documents/Claude",
                ]
            )

    # Check each path
    for path in paths_to_check:
        info = check_path_exists(path)
        status = "✓ EXISTS" if info["exists"] else "✗ Not found"
        print(f"\n{status} {path}")
        if info["exists"]:
            print(f"  Type: {'Directory' if info['is_dir'] else 'File'}")
            if info.get("contents"):
                print(f"  Contents ({info['num_items']} items): {info['contents']}")

    # Search for Claude directories
    print_section("Searching for Claude Directories")
    search_bases = [
        os.environ.get("HOME", "/home"),
        "/root",
        "/home",
        "/mnt/c/Users",
        "/mnt/c",
        os.getcwd(),
    ]

    found_dirs = find_claude_directories(search_bases)
    if found_dirs:
        print(f"Found {len(found_dirs)} Claude-related directories:")
        for dir_path in found_dirs:
            print(f"  - {dir_path}")
            # Check for projects subdirectory
            projects_path = Path(dir_path) / "projects"
            if projects_path.exists():
                print(f"    └─ projects/ ({len(list(projects_path.iterdir()))} items)")
    else:
        print("No Claude directories found in common locations")

    # File system permissions
    print_section("File System Permissions")
    test_paths = ["/root", "/home", os.environ.get("HOME", "/"), "/mnt/c"]
    for path in test_paths:
        if os.path.exists(path):
            try:
                can_read = os.access(path, os.R_OK)
                can_write = os.access(path, os.W_OK)
                can_exec = os.access(path, os.X_OK)
                print(f"{path}: Read={can_read}, Write={can_write}, Execute={can_exec}")
            except Exception as e:
                print(f"{path}: Error checking permissions - {e}")

    # Process information
    print_section("Process Information")
    print(f"Process ID: {os.getpid()}")
    print(f"Parent Process ID: {os.getppid()}")
    print(f"Effective UID: {os.geteuid()}")
    print(f"Effective GID: {os.getegid()}")

    # Additional diagnostics
    print_section("Additional Diagnostics")

    # Check if we're in a container
    if os.path.exists("/.dockerenv"):
        print("Running in Docker container")
    elif os.path.exists("/proc/1/cgroup"):
        with open("/proc/1/cgroup", "r") as f:
            if "docker" in f.read():
                print("Likely running in Docker container")

    # Check mount points
    print("\nMount points:")
    mounts = run_command("mount | grep -E '(claude|home|root|mnt)' | head -10")
    if mounts:
        print(mounts)

    # Summary
    print_section("Summary")
    if found_dirs:
        print(f"✓ Found {len(found_dirs)} Claude directories")
        print("\nRecommended actions:")
        print("1. Check if these directories contain the expected project files")
        print("2. Verify file permissions allow reading")
        print("3. Ensure the Claude extension is looking in the correct locations")
    else:
        print("✗ No Claude directories found")
        print("\nPossible issues:")
        print("1. Claude directories may be in non-standard locations")
        print("2. Permission issues preventing directory discovery")
        print("3. Claude may not be installed or configured on this system")
        print("4. The directories might be on the Windows side if using WSL")

    print("\nTo manually create Claude project directory:")
    print("  mkdir -p ~/.claude/projects")
    print("  # or for root user:")
    print("  mkdir -p /root/.claude/projects")


if __name__ == "__main__":
    main()
