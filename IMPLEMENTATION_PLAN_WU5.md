# WU-5: Chrome v20 App-Bound Encryption

## Context
Chrome 127+ (v20 cookie format) introduced app-bound encryption on Windows.
The encryption key in `Local State` is no longer just DPAPI-protected -- it is
additionally encrypted via Chrome's IElevation COM interface, which is only
callable from a SYSTEM-level context.

Standard DPAPI decrypt (`CryptUnprotectData`) works for v10 cookies but
**silently produces garbage** for v20 app-bound keys.

## Changes

### 1. `chromium_decrypt.py` modifications

- **`detect_chrome_version()`**: Read `Local State` to extract Chrome version
  string. Returns `(major, minor, build, patch)` tuple or `None`.

- **`_get_key_windows()`**: After standard DPAPI path, detect if the key might
  be app-bound encrypted (Chrome >= 127). If standard DPAPI decryption succeeds
  but Chrome is v127+, log a warning that the key may be app-bound and
  decryption may fail on v20 cookies.

- **`_try_app_bound_key_windows()`**: Attempt to decrypt the app-bound key via
  the IElevation COM interface (`{708860E0-F641-4611-8895-7D867DD3675B}`).
  Only works when running as SYSTEM. Returns `None` with a clear warning when
  not running as SYSTEM.

- **`decrypt_cookie_value()`**: When v20 decryption fails, log a clear warning
  about app-bound encryption. Add fallback: if v20 fails, try v10 cookies that
  still use the standard DPAPI key.

### 2. New collector: `collectors/chrome/app_bound_decrypt.py`

- Registered as `@CollectorRegistry.register`
- `service="chrome"`, `source="app_bound_decrypt"`, `platforms=["windows"]`,
  `stealth_score=3`
- `discover()`: Detect Chrome v127+ by reading `Local State` version info,
  report whether app-bound keys are present
- `collect()`: Attempt IElevation COM decryption, graceful fallback to standard
  DPAPI, report which keys worked and which didn't

### Design Decisions

- **Zero new dependencies**: Everything uses `ctypes` and `comtypes` patterns
  that are stdlib on Windows. On non-Windows, the collector simply skips.
- **Graceful degradation**: If IElevation fails (not SYSTEM), fall back to
  standard DPAPI. If that fails for v20, warn clearly and return what v10
  cookies can be decrypted.
- **IElevation limitation**: The COM interface requires SYSTEM privileges.
  This is clearly documented. For non-SYSTEM, we recommend the CDP-based
  `cdp_cookies` collector which bypasses all encryption.
