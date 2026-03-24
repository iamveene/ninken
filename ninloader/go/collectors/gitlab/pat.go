package gitlab

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
	registry.Register("gitlab", "pat", func() collector.Collector {
		return &PatCollector{BaseCollector: collector.BaseCollector{Svc: "gitlab", Src: "pat"}}
	})
}

// PatCollector extracts GitLab PATs from glab CLI config, env vars,
// macOS Keychain, and ~/.netrc.
type PatCollector struct {
	collector.BaseCollector
}

func (c *PatCollector) Service() string      { return c.Svc }
func (c *PatCollector) Source() string        { return c.Src }
func (c *PatCollector) StealthScore() int     { return 5 }
func (c *PatCollector) Platforms() []string   { return nil }

var (
	reGlabHostsBlock = regexp.MustCompile(`^hosts:\s*$`)
	reGlabTopLevel   = regexp.MustCompile(`^[a-zA-Z]`)
	reGlabHostKey    = regexp.MustCompile(`^\s{2,4}(\S+):\s*$`)
	reGlabKV         = regexp.MustCompile(`^\s{4,8}(\w[\w_]*):\s*(.+)$`)
)

type glabHostEntry struct {
	host string
	data map[string]string
}

// ------------------------------------------------------------------ //
// glab config YAML parsing (regex, no YAML dependency)
// ------------------------------------------------------------------ //

// parseConfigYml parses glab config.yml using regex.
//
// Format:
//
//	hosts:
//	    gitlab.com:
//	        token: glpat-xxxxxxxx
//	        api_host: gitlab.com
//	        git_protocol: https
//	        user: username
func (c *PatCollector) parseConfigYml(text string) []glabHostEntry {
	var entries []glabHostEntry
	inHosts := false
	var currentHost string
	currentData := map[string]string{}

	for _, line := range strings.Split(text, "\n") {
		// Detect the top-level `hosts:` block
		if reGlabHostsBlock.MatchString(line) {
			inHosts = true
			continue
		}

		// Another top-level key ends the hosts block
		if inHosts && reGlabTopLevel.MatchString(line) {
			if currentHost != "" && len(currentData) > 0 {
				entries = append(entries, glabHostEntry{host: currentHost, data: currentData})
			}
			inHosts = false
			currentHost = ""
			currentData = map[string]string{}
			continue
		}

		if !inHosts {
			continue
		}

		// Host key (one level of indent)
		if m := reGlabHostKey.FindStringSubmatch(line); m != nil {
			if currentHost != "" && len(currentData) > 0 {
				entries = append(entries, glabHostEntry{host: currentHost, data: currentData})
			}
			currentHost = m[1]
			currentData = map[string]string{}
			continue
		}

		// Indented key-value under a host
		if m := reGlabKV.FindStringSubmatch(line); m != nil && currentHost != "" {
			currentData[m[1]] = strings.TrimSpace(m[2])
		}
	}

	// Flush last host
	if currentHost != "" && len(currentData) > 0 {
		entries = append(entries, glabHostEntry{host: currentHost, data: currentData})
	}

	return entries
}

// ------------------------------------------------------------------ //
// Environment variables
// ------------------------------------------------------------------ //

// readEnv checks GITLAB_TOKEN and GITLAB_PRIVATE_TOKEN.
// Returns (varName, token) or ("", "").
func (c *PatCollector) readEnv() (string, string) {
	for _, v := range []string{"GITLAB_TOKEN", "GITLAB_PRIVATE_TOKEN"} {
		val := os.Getenv(v)
		if strings.TrimSpace(val) != "" {
			return v, strings.TrimSpace(val)
		}
	}
	return "", ""
}

// ------------------------------------------------------------------ //
// .netrc parsing
// ------------------------------------------------------------------ //

// netrcEntry holds a parsed .netrc machine entry.
type netrcEntry struct {
	machine  string
	login    string
	password string
}

// parseNetrc parses .netrc for GitLab entries.
// Handles both single-line and multi-line .netrc formats.
func (c *PatCollector) parseNetrc(text string) []netrcEntry {
	var results []netrcEntry

	// Normalize: collapse lines and tokenize
	tokens := strings.Fields(text)
	i := 0
	for i < len(tokens) {
		if tokens[i] == "machine" {
			machine := ""
			if i+1 < len(tokens) {
				machine = tokens[i+1]
			}
			login := ""
			password := ""
			i += 2

			// Read login/password pairs until next machine or end
			for i < len(tokens) && tokens[i] != "machine" {
				switch tokens[i] {
				case "login":
					if i+1 < len(tokens) {
						login = tokens[i+1]
						i += 2
					} else {
						i++
					}
				case "password":
					if i+1 < len(tokens) {
						password = tokens[i+1]
						i += 2
					} else {
						i++
					}
				case "account":
					if i+1 < len(tokens) {
						i += 2 // skip account field
					} else {
						i++
					}
				case "macdef":
					// Skip macro definitions
					goto nextMachine
				default:
					i++
				}
			}

		nextMachine:
			// Only include GitLab-related machines
			if strings.Contains(strings.ToLower(machine), "gitlab") && password != "" {
				results = append(results, netrcEntry{
					machine:  machine,
					login:    login,
					password: password,
				})
			}
		} else {
			i++
		}
	}

	return results
}

// tokenType returns "glpat" if the token starts with "glpat-", otherwise "other".
func tokenType(token string) string {
	if strings.HasPrefix(token, "glpat-") {
		return "glpat"
	}
	return "other"
}

// ------------------------------------------------------------------ //
// Discover
// ------------------------------------------------------------------ //

func (c *PatCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	// 1. glab config file
	configPath := platform.GlabConfigPath()
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to parse %s: %v", configPath, err))
		} else {
			entries := c.parseConfigYml(string(data))
			for _, entry := range entries {
				token := entry.data["token"]
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
					// Check Keychain as fallback
					kc := c.readKeychain(entry.host)
					if kc != "" {
						details = fmt.Sprintf("token in keychain (extractable, %s...)", kc[:8])
					} else {
						details = "token in system keyring (not extractable)"
					}
				}

				results = append(results, &types.DiscoveredToken{
					Service:      c.Svc,
					Source:       c.Src,
					Path:         configPath,
					AccountHint:  fmt.Sprintf("%s@%s", user, entry.host),
					StealthScore: 5,
					Details:      details,
				})
			}
		}
	}

	// 2. Environment variables
	varName, token := c.readEnv()
	if varName != "" {
		var preview string
		if len(token) > 8 {
			preview = fmt.Sprintf("token=%s... (from $%s)", token[:8], varName)
		} else {
			preview = fmt.Sprintf("token=present (from $%s)", varName)
		}
		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         fmt.Sprintf("env:%s", varName),
			StealthScore: 5,
			Details:      preview,
		})
	}

	// 3. macOS Keychain (standalone check — not tied to config file)
	configHosts := map[string]bool{}
	if _, err := os.Stat(configPath); err == nil {
		data, _ := os.ReadFile(configPath)
		if data != nil {
			for _, entry := range c.parseConfigYml(string(data)) {
				configHosts[entry.host] = true
			}
		}
	}

	if !configHosts["gitlab.com"] {
		kc := c.readKeychain("gitlab.com")
		if kc != "" {
			results = append(results, &types.DiscoveredToken{
				Service:      c.Svc,
				Source:       c.Src,
				Path:         "keychain:glab:gitlab.com",
				StealthScore: 5,
				Details:      fmt.Sprintf("token in keychain (extractable, %s...)", kc[:8]),
			})
		}
	}

	// 4. .netrc
	netrcPath := platform.NetrcPath()
	if _, err := os.Stat(netrcPath); err == nil {
		data, err := os.ReadFile(netrcPath)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to parse %s: %v", netrcPath, err))
		} else {
			netrcEntries := c.parseNetrc(string(data))
			for _, ne := range netrcEntries {
				var preview string
				if len(ne.password) > 8 {
					preview = fmt.Sprintf("token=%s... (from .netrc)", ne.password[:8])
				} else {
					preview = "token=present (from .netrc)"
				}
				hint := ne.machine
				if ne.login != "" {
					hint = fmt.Sprintf("%s@%s", ne.login, ne.machine)
				}
				results = append(results, &types.DiscoveredToken{
					Service:      c.Svc,
					Source:       c.Src,
					Path:         netrcPath,
					AccountHint:  hint,
					StealthScore: 5,
					Details:      preview,
				})
			}
		}
	}

	return results
}

// ------------------------------------------------------------------ //
// Collect
// ------------------------------------------------------------------ //

func (c *PatCollector) Collect() []*types.CollectedToken {
	var results []*types.CollectedToken
	seen := map[string]bool{} // deduplicate across sources

	// 1. glab config file
	configPath := platform.GlabConfigPath()
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to collect from %s: %v", configPath, err))
		} else {
			entries := c.parseConfigYml(string(data))
			for _, entry := range entries {
				token := entry.data["token"]
				tokenSrc := "config"

				// Fall back to Keychain if no token in config
				if token == "" {
					token = c.readKeychain(entry.host)
					tokenSrc = "keychain"
				}

				if token == "" {
					continue
				}
				if seen[token] {
					continue
				}
				seen[token] = true

				user := entry.data["user"]
				if user == "" {
					user = "unknown"
				}
				protocol := entry.data["git_protocol"]
				if protocol == "" {
					protocol = "https"
				}
				apiHost := entry.data["api_host"]
				if apiHost == "" {
					apiHost = entry.host
				}

				tok := types.NewCollectedToken(c.Svc, c.Src, 5)
				tok.Username = user
				tok.AccessToken = types.Secure(token)
				tok.Extra["host"] = entry.host
				tok.Extra["api_host"] = apiHost
				tok.Extra["git_protocol"] = protocol
				tok.Extra["token_source"] = tokenSrc
				tok.Extra["token_type"] = tokenType(token)
				results = append(results, tok)
			}
		}
	}

	// 2. Environment variables
	varName, envToken := c.readEnv()
	if varName != "" && !seen[envToken] {
		seen[envToken] = true
		tok := types.NewCollectedToken(c.Svc, c.Src, 5)
		tok.AccessToken = types.Secure(envToken)
		tok.Extra["host"] = "gitlab.com"
		tok.Extra["token_source"] = "env"
		tok.Extra["env_var"] = varName
		tok.Extra["token_type"] = tokenType(envToken)
		results = append(results, tok)
	}

	// 3. macOS Keychain (standalone — for gitlab.com if not already collected)
	kc := c.readKeychain("gitlab.com")
	if kc != "" && !seen[kc] {
		seen[kc] = true
		tok := types.NewCollectedToken(c.Svc, c.Src, 5)
		tok.AccessToken = types.Secure(kc)
		tok.Extra["host"] = "gitlab.com"
		tok.Extra["token_source"] = "keychain"
		tok.Extra["token_type"] = tokenType(kc)
		results = append(results, tok)
	}

	// 4. .netrc
	netrcPath := platform.NetrcPath()
	if _, err := os.Stat(netrcPath); err == nil {
		data, err := os.ReadFile(netrcPath)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to collect from %s: %v", netrcPath, err))
		} else {
			netrcEntries := c.parseNetrc(string(data))
			for _, ne := range netrcEntries {
				if seen[ne.password] {
					continue
				}
				seen[ne.password] = true

				tok := types.NewCollectedToken(c.Svc, c.Src, 5)
				if ne.login != "" {
					tok.Username = ne.login
				}
				tok.AccessToken = types.Secure(ne.password)
				tok.Extra["host"] = ne.machine
				tok.Extra["token_source"] = "netrc"
				tok.Extra["token_type"] = tokenType(ne.password)
				results = append(results, tok)
			}
		}
	}

	return results
}
