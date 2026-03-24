"""Cross-platform path helpers for token discovery."""

from __future__ import annotations

import os
import sys
import platform
from pathlib import Path
from typing import Optional


def get_platform() -> str:
    """Return normalized platform: 'windows', 'macos', or 'linux'."""
    system = platform.system().lower()
    if system == "darwin":
        return "macos"
    if system == "windows":
        return "windows"
    return "linux"


def home_dir() -> Path:
    """Return the user's home directory."""
    return Path.home()


def config_dir() -> Path:
    """Return the platform-appropriate config directory.

    - macOS: ~/Library/Application Support
    - Linux: ~/.config (XDG_CONFIG_HOME)
    - Windows: %APPDATA%
    """
    plat = get_platform()
    if plat == "macos":
        return home_dir() / "Library" / "Application Support"
    if plat == "windows":
        appdata = os.environ.get("APPDATA")
        if appdata:
            return Path(appdata)
        return home_dir() / "AppData" / "Roaming"
    # Linux / other: XDG_CONFIG_HOME or ~/.config
    xdg = os.environ.get("XDG_CONFIG_HOME")
    if xdg:
        return Path(xdg)
    return home_dir() / ".config"


def chrome_user_data_dir() -> Path:
    """Return the Chrome user data directory for the current platform."""
    plat = get_platform()
    if plat == "macos":
        return home_dir() / "Library" / "Application Support" / "Google" / "Chrome"
    if plat == "windows":
        local = os.environ.get("LOCALAPPDATA", str(home_dir() / "AppData" / "Local"))
        return Path(local) / "Google" / "Chrome" / "User Data"
    return home_dir() / ".config" / "google-chrome"


def edge_user_data_dir() -> Path:
    """Return the Edge user data directory for the current platform."""
    plat = get_platform()
    if plat == "macos":
        return home_dir() / "Library" / "Application Support" / "Microsoft Edge"
    if plat == "windows":
        local = os.environ.get("LOCALAPPDATA", str(home_dir() / "AppData" / "Local"))
        return Path(local) / "Microsoft" / "Edge" / "User Data"
    return home_dir() / ".config" / "microsoft-edge"


def teams_data_dir() -> Path:
    """Return the Microsoft Teams desktop data directory."""
    plat = get_platform()
    if plat == "macos":
        return home_dir() / "Library" / "Application Support" / "Microsoft" / "Teams"
    if plat == "windows":
        appdata = os.environ.get("APPDATA", str(home_dir() / "AppData" / "Roaming"))
        return Path(appdata) / "Microsoft" / "Teams"
    return home_dir() / ".config" / "Microsoft" / "Microsoft Teams"


def slack_data_dir() -> Path:
    """Return the Slack desktop data directory."""
    plat = get_platform()
    if plat == "macos":
        return home_dir() / "Library" / "Application Support" / "Slack"
    if plat == "windows":
        appdata = os.environ.get("APPDATA", str(home_dir() / "AppData" / "Roaming"))
        return Path(appdata) / "Slack"
    return home_dir() / ".config" / "Slack"


def aws_dir() -> Path:
    """Return the AWS config/credentials directory."""
    return home_dir() / ".aws"


def gcloud_dir() -> Path:
    """Return the gcloud configuration directory."""
    plat = get_platform()
    # gcloud uses ~/.config/gcloud on all platforms unless CLOUDSDK_CONFIG is set
    cloudsdk = os.environ.get("CLOUDSDK_CONFIG")
    if cloudsdk:
        return Path(cloudsdk)
    if plat == "windows":
        appdata = os.environ.get("APPDATA", str(home_dir() / "AppData" / "Roaming"))
        return Path(appdata) / "gcloud"
    return home_dir() / ".config" / "gcloud"


def gh_cli_dir() -> Path:
    """Return the GitHub CLI config directory."""
    plat = get_platform()
    if plat == "windows":
        appdata = os.environ.get("APPDATA", str(home_dir() / "AppData" / "Roaming"))
        return Path(appdata) / "GitHub CLI"
    return home_dir() / ".config" / "gh"


def git_credentials_path() -> Path:
    """Return the path to ~/.git-credentials."""
    return home_dir() / ".git-credentials"


def expand_path(path: str) -> Path:
    """Expand ~, env vars, and resolve a path."""
    return Path(os.path.expandvars(os.path.expanduser(path))).resolve()
