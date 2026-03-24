package aws

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("aws", "sso_cache", func() collector.Collector {
		return &SsoCacheCollector{BaseCollector: collector.BaseCollector{Svc: "aws", Src: "sso_cache"}}
	})
}

// SsoCacheCollector reads ~/.aws/sso/cache/*.json for active SSO sessions.
type SsoCacheCollector struct {
	collector.BaseCollector
}

func (c *SsoCacheCollector) Service() string            { return c.Svc }
func (c *SsoCacheCollector) Source() string              { return c.Src }
func (c *SsoCacheCollector) StealthScore() int           { return 5 }
func (c *SsoCacheCollector) Platforms() []string         { return nil }
func (c *SsoCacheCollector) IsPlatformSupported() bool   { return true }

func (c *SsoCacheCollector) cacheDir() string {
	return filepath.Join(platform.AWSDir(), "sso", "cache")
}

func (c *SsoCacheCollector) Discover() []*types.DiscoveredToken {
	cacheDir := c.cacheDir()
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if !os.IsNotExist(err) {
			c.Warn(fmt.Sprintf("Failed to scan %s: %v", cacheDir, err))
		}
		return nil
	}

	var results []*types.DiscoveredToken
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(cacheDir, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			continue
		}

		// SSO cache files with accessToken are active sessions
		if _, ok := parsed["accessToken"]; ok {
			account := "unknown"
			if v, ok := parsed["accountId"].(string); ok && v != "" {
				account = v
			}
			role := "unknown"
			if v, ok := parsed["roleName"].(string); ok && v != "" {
				role = v
			}
			expiresAt := "?"
			if v, ok := parsed["expiresAt"].(string); ok && v != "" {
				expiresAt = v
			}

			results = append(results, &types.DiscoveredToken{
				Service:      c.Svc,
				Source:       c.Src,
				Path:         filePath,
				AccountHint:  fmt.Sprintf("%s/%s", account, role),
				StealthScore: c.StealthScore(),
				Details:      fmt.Sprintf("expires=%s", expiresAt),
			})
		} else if _, ok := parsed["startUrl"]; ok {
			// SSO registration cache (client token)
			startUrl := "?"
			if v, ok := parsed["startUrl"].(string); ok && v != "" {
				startUrl = v
			}

			results = append(results, &types.DiscoveredToken{
				Service:      c.Svc,
				Source:       c.Src,
				Path:         filePath,
				AccountHint:  startUrl,
				StealthScore: c.StealthScore(),
				Details:      "sso_registration",
			})
		}
	}

	return results
}

func (c *SsoCacheCollector) Collect() []*types.CollectedToken {
	cacheDir := c.cacheDir()
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if !os.IsNotExist(err) {
			c.Warn(fmt.Sprintf("Failed to collect from %s: %v", cacheDir, err))
		}
		return nil
	}

	var results []*types.CollectedToken
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(cacheDir, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			continue
		}

		accessToken, ok := parsed["accessToken"].(string)
		if !ok || accessToken == "" {
			continue
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())

		if v, ok := parsed["accountId"].(string); ok {
			tok.AccountID = v
		}
		if v, ok := parsed["roleName"].(string); ok {
			tok.Username = v
		}

		tok.AccessToken = types.Secure(accessToken)

		if v, ok := parsed["expiresAt"].(string); ok {
			tok.ExpiresAt = v
		}

		// Extra fields matching Python behavior
		if v, ok := parsed["startUrl"].(string); ok {
			tok.Extra["start_url"] = v
		}
		if v, ok := parsed["region"].(string); ok {
			tok.Extra["region"] = v
		}
		if v, ok := parsed["roleName"].(string); ok {
			tok.Extra["role_name"] = v
		}
		if v, ok := parsed["accountId"].(string); ok {
			tok.Extra["account_id"] = v
		}

		results = append(results, tok)
	}

	return results
}
