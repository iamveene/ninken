//go:build darwin

package gitlab

import (
	"context"
	"encoding/base64"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// readKeychain reads a glab token from macOS Keychain.
// glab CLI uses go-keyring which may base64-wrap values with a
// "go-keyring-base64:" prefix — same pattern as gh CLI.
func (c *PatCollector) readKeychain(host string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "security", "find-generic-password", "-s", fmt.Sprintf("glab:%s", host), "-w")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}

	raw := strings.TrimSpace(string(out))
	if raw == "" {
		return ""
	}

	// go-keyring stores base64-encoded values with a prefix
	if strings.HasPrefix(raw, "go-keyring-base64:") {
		encoded := raw[len("go-keyring-base64:"):]
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return ""
		}
		return string(decoded)
	}

	return raw
}
