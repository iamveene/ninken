// Package chromium implements cross-platform Chromium cookie extraction and
// decryption. It handles Chrome's per-platform encryption schemes:
//
//   - macOS:   PBKDF2(Keychain password, salt="saltysalt", iter=1003) -> AES-128-CBC
//   - Windows: DPAPI CryptUnprotectData on os_crypt.encrypted_key -> AES-256-GCM
//   - Linux:   PBKDF2("peanuts" or secret-service, salt="saltysalt", iter=1) -> AES-128-CBC
//
// This is a direct port of ninloader/python/ninloader/core/chromium_decrypt.py.
//
// Uses modernc.org/sqlite (pure Go, no CGo) for database access.
package chromium

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

// Cookie represents a single decrypted browser cookie.
type Cookie struct {
	Host     string
	Name     string
	Value    string
	Path     string
	Expires  int64
	Secure   bool
	HTTPOnly bool
}

// ExtractCookies reads and decrypts cookies from a Chromium-based browser.
//
// browserDataDir is the browser's user data directory (e.g., Chrome User Data).
// profile is the profile subdirectory name (e.g., "Default", "Profile 1").
// hostPatterns filters cookies by host (substring match via SQL LIKE).
// cookieNames optionally filters by cookie name (exact match).
//
// The Cookies SQLite database is copied to a temp file before reading to
// avoid lock conflicts with a running browser. WAL and journal files are
// also copied if present.
func ExtractCookies(browserDataDir string, profile string, hostPatterns []string, cookieNames []string) ([]Cookie, error) {
	// Locate the Cookies database.
	cookiesDB := filepath.Join(browserDataDir, profile, "Cookies")
	if _, err := os.Stat(cookiesDB); os.IsNotExist(err) {
		// Newer Chrome versions moved Cookies to Network/Cookies.
		cookiesDB = filepath.Join(browserDataDir, profile, "Network", "Cookies")
		if _, err := os.Stat(cookiesDB); os.IsNotExist(err) {
			return nil, fmt.Errorf("cookies database not found for profile %s", profile)
		}
	}

	// Copy database to temp file to avoid lock conflicts with running Chrome.
	tmpFile, err := os.CreateTemp("", "ninloader-cookies-*.db")
	if err != nil {
		return nil, fmt.Errorf("create temp db: %w", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()

	defer func() {
		// Clean up all temp files.
		for _, suffix := range []string{"", "-wal", "-journal"} {
			os.Remove(tmpPath + suffix)
		}
	}()

	// Copy the main database file.
	if err := copyFile(cookiesDB, tmpPath); err != nil {
		return nil, fmt.Errorf("copy cookies db: %w", err)
	}

	// Also copy WAL and journal if present (contains recent uncommitted writes).
	for _, suffix := range []string{"-wal", "-journal"} {
		src := cookiesDB + suffix
		if _, err := os.Stat(src); err == nil {
			_ = copyFile(src, tmpPath+suffix)
		}
	}

	// Get the decryption key.
	key, err := GetChromeKey(false)
	if err != nil {
		return nil, fmt.Errorf("get chrome key: %w", err)
	}

	// Open the temp database.
	db, err := sql.Open("sqlite", tmpPath)
	if err != nil {
		return nil, fmt.Errorf("open cookies db: %w", err)
	}
	defer db.Close()

	// Enable WAL mode for reading.
	_, _ = db.Exec("PRAGMA journal_mode=wal")

	// Build query with optional host filter.
	query := "SELECT host_key, name, encrypted_value, value, path, expires_utc, is_secure, is_httponly FROM cookies"
	var args []any
	var whereClauses []string

	if len(hostPatterns) > 0 {
		var hostClauses []string
		for _, pattern := range hostPatterns {
			hostClauses = append(hostClauses, "host_key LIKE ?")
			args = append(args, "%"+pattern+"%")
		}
		whereClauses = append(whereClauses, "("+strings.Join(hostClauses, " OR ")+")")
	}

	if len(cookieNames) > 0 {
		var nameClauses []string
		for _, name := range cookieNames {
			nameClauses = append(nameClauses, "name = ?")
			args = append(args, name)
		}
		whereClauses = append(whereClauses, "("+strings.Join(nameClauses, " OR ")+")")
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY host_key, name"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query cookies: %w", err)
	}
	defer rows.Close()

	var results []Cookie
	for rows.Next() {
		var (
			host, name, path    string
			encValue, plainValue []byte
			plainStr            sql.NullString
			expires             int64
			secure, httponly     int
		)
		// encrypted_value is a BLOB, value is TEXT.
		if err := rows.Scan(&host, &name, &encValue, &plainStr, &path, &expires, &secure, &httponly); err != nil {
			continue
		}
		if plainStr.Valid {
			plainValue = []byte(plainStr.String)
		}

		var value string
		if len(encValue) > 0 {
			decrypted, err := DecryptCookieValue(encValue, key)
			if err != nil || decrypted == "" {
				// Fall back to plain value.
				value = string(plainValue)
			} else {
				value = decrypted
			}
		} else {
			value = string(plainValue)
		}

		if value == "" {
			continue
		}

		results = append(results, Cookie{
			Host:     host,
			Name:     name,
			Value:    value,
			Path:     path,
			Expires:  expires,
			Secure:   secure != 0,
			HTTPOnly: httponly != 0,
		})
	}

	return results, nil
}

// DecryptCookieValue decrypts a single Chrome encrypted cookie value.
//
// Cookie prefix detection:
//   - v10/v11 (3 bytes): strip prefix, call platform-specific decryptor
//   - v20: app-bound encryption (Windows only), log warning
//   - No recognized prefix: treat as plaintext
func DecryptCookieValue(encrypted []byte, key []byte) (string, error) {
	if len(encrypted) == 0 {
		return "", nil
	}

	// Check version prefix (first 3 bytes).
	if len(encrypted) >= 3 {
		prefix := string(encrypted[:3])

		switch prefix {
		case "v10", "v11":
			return decryptPlatform(encrypted[3:], key)

		case "v20":
			// v20 = app-bound encryption (Chrome 127+, Windows only).
			fmt.Fprintf(os.Stderr, "[WARN] [chromium] v20 cookie encountered — "+
				"app-bound encryption (Chrome 127+ Windows). "+
				"Use CDP-based cookie extraction to bypass.\n")
			return "", fmt.Errorf("v20 app-bound encryption not supported")
		}
	}

	// No recognized prefix — treat as plaintext.
	return string(encrypted), nil
}

// ReadLocalState reads and parses Chrome's Local State JSON file.
func ReadLocalState(browserDataDir string) (map[string]any, error) {
	path := filepath.Join(browserDataDir, "Local State")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read Local State: %w", err)
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parse Local State: %w", err)
	}

	return result, nil
}

// ListProfiles returns the profile directory names found in the browser data dir.
// It looks for directories containing a "Cookies" or "Network/Cookies" file.
func ListProfiles(browserDataDir string) []string {
	entries, err := os.ReadDir(browserDataDir)
	if err != nil {
		return nil
	}

	var profiles []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		// Check for Cookies DB in either location.
		cookiesPath := filepath.Join(browserDataDir, name, "Cookies")
		networkCookiesPath := filepath.Join(browserDataDir, name, "Network", "Cookies")
		if fileExists(cookiesPath) || fileExists(networkCookiesPath) {
			profiles = append(profiles, name)
		}
	}

	return profiles
}

// ── Helpers ──────────────────────────────────────────────────

// copyFile copies src to dst using os.ReadFile/WriteFile.
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0600)
}

// fileExists returns true if path exists and is a regular file.
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// decryptPlatform dispatches to the platform-specific decryptor.
// On darwin/linux this is DecryptAESCBC, on windows it is DecryptAESGCM.
// Defined in the platform-specific files (chromium_darwin.go, etc.).
// This function is implemented via build tags.
