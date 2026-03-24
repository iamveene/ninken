//go:build darwin

package github

import (
	"context"
	"encoding/base64"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// readKeychain reads a GitHub CLI token from macOS Keychain.
// gh CLI stores tokens via go-keyring which may base64-wrap the value
// with a "go-keyring-base64:" prefix.
func (c *GhCliCollector) readKeychain(host string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "security", "find-generic-password", "-s", fmt.Sprintf("gh:%s", host), "-w")
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
