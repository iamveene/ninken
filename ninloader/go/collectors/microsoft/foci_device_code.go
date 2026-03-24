package microsoft

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/ninken/ninloader-go/internal/validator"
)

// FOCI (Family of Client IDs) -- first-party Microsoft apps, no client_secret needed.
// A refresh token from any FOCI app can be exchanged for tokens to ANY other FOCI app.
var FOCIClients = map[string]string{
	"teams":          "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
	"office":         "d3590ed6-52b3-4102-aeff-aad2292ab01c",
	"outlook_mobile": "27922004-5251-4030-b22d-91ecd9a37ea4",
	"onedrive":       "ab9b8c07-8f02-4f72-87fa-80105867a763",
	"azure_cli":      "04b07795-8ddb-461a-bbee-02f9e1bf7b46",
}

const (
	defaultFOCIClient = "office"
	defaultFOCITenant = "common"
	defaultFOCIScopes = ".default offline_access"
)

func init() {
	registry.Register("microsoft", "foci_device_code", func() collector.Collector {
		return &FOCIDeviceCodeCollector{
			BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "foci_device_code"},
			clientName:    defaultFOCIClient,
			tenant:        defaultFOCITenant,
			scopes:        defaultFOCIScopes,
		}
	})
}

// FOCIDeviceCodeCollector acquires Microsoft tokens via the OAuth 2.0 device
// authorization grant (RFC 8628) using a FOCI client ID. A refresh token from
// any FOCI app can be silently exchanged for access tokens to ALL other FOCI
// apps without additional user interaction.
type FOCIDeviceCodeCollector struct {
	collector.BaseCollector
	clientName string
	tenant     string
	scopes     string
}

func (c *FOCIDeviceCodeCollector) Service() string          { return c.Svc }
func (c *FOCIDeviceCodeCollector) Source() string            { return c.Src }
func (c *FOCIDeviceCodeCollector) StealthScore() int         { return 3 }
func (c *FOCIDeviceCodeCollector) Platforms() []string       { return nil }
func (c *FOCIDeviceCodeCollector) IsPlatformSupported() bool { return true }

// Configure accepts CLI options: --client, --tenant, --scopes.
func (c *FOCIDeviceCodeCollector) Configure(opts collector.CollectOptions) {
	if opts.ClientName != "" {
		c.clientName = opts.ClientName
	}
	if opts.TenantID != "" {
		c.tenant = opts.TenantID
	}
	if opts.Scopes != "" {
		c.scopes = opts.Scopes
	}
}

// Discover always returns one result -- device code flow is always available.
func (c *FOCIDeviceCodeCollector) Discover() []*types.DiscoveredToken {
	return []*types.DiscoveredToken{
		{
			Service:      c.Svc,
			Source:       c.Src,
			StealthScore: c.StealthScore(),
			Details:      "interactive FOCI device code flow (stdlib, no msal needed)",
		},
	}
}

// Collect runs the device code flow and returns the collected FOCI token.
func (c *FOCIDeviceCodeCollector) Collect() []*types.CollectedToken {
	clientID := c.resolveClientID()
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", c.tenant)
	deviceCodeURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/devicecode", c.tenant)

	c.Info(fmt.Sprintf("Starting FOCI device code flow (client=%s, scopes=%s)", c.clientName, c.scopes))

	// Step 1: Initiate device code flow.
	flowResp, err := postForm(deviceCodeURL, url.Values{
		"client_id": {clientID},
		"scope":     {c.scopes},
	})
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to initiate device code flow: %v", err))
		return nil
	}

	deviceCode, _ := flowResp["device_code"].(string)
	userCode, _ := flowResp["user_code"].(string)
	verificationURI, _ := flowResp["verification_uri"].(string)
	interval := 5.0
	if v, ok := flowResp["interval"].(float64); ok {
		interval = v
	}
	expiresIn := 900.0
	if v, ok := flowResp["expires_in"].(float64); ok {
		expiresIn = v
	}

	if deviceCode == "" || userCode == "" {
		c.Warn(fmt.Sprintf("Invalid device code response: %v", flowResp))
		return nil
	}

	// Step 2: Display the code to the operator.
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "============================================================")
	fmt.Fprintln(os.Stderr, "  MICROSOFT FOCI DEVICE CODE FLOW")
	fmt.Fprintln(os.Stderr, "============================================================")
	fmt.Fprintf(os.Stderr, "  Visit:  %s\n", verificationURI)
	fmt.Fprintf(os.Stderr, "  Code:   %s\n", userCode)
	fmt.Fprintf(os.Stderr, "  Client: %s (%s)\n", c.clientName, clientID)
	fmt.Fprintln(os.Stderr, "============================================================")
	fmt.Fprintln(os.Stderr)
	c.Info(fmt.Sprintf("Waiting for user to approve (timeout=%.0fs) ...", expiresIn))

	// Step 3: Poll the token endpoint.
	deadline := time.Now().Add(time.Duration(expiresIn) * time.Second)
	pollInterval := time.Duration(interval) * time.Second

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)

		body, httpErr, rawBody := postFormRaw(tokenURL, url.Values{
			"client_id":   {clientID},
			"device_code": {deviceCode},
			"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
		})

		if httpErr != nil {
			// Parse error response body.
			var errBody map[string]any
			if rawBody != nil {
				_ = json.Unmarshal(rawBody, &errBody)
			}
			errorCode, _ := errBody["error"].(string)

			switch errorCode {
			case "authorization_pending":
				continue
			case "slow_down":
				pollInterval += 5 * time.Second
				continue
			case "authorization_declined":
				c.Warn("User declined the device code authorization.")
				return nil
			case "expired_token":
				c.Warn("Device code expired before user approved.")
				return nil
			default:
				desc, _ := errBody["error_description"].(string)
				if desc == "" {
					desc = httpErr.Error()
				}
				c.Warn(fmt.Sprintf("Token polling error: %s -- %s", errorCode, desc))
				return nil
			}
		}

		if body == nil {
			c.Warn("Empty token response")
			return nil
		}

		// Step 4: Token received.
		accessToken, _ := body["access_token"].(string)
		refreshToken, _ := body["refresh_token"].(string)
		idToken, _ := body["id_token"].(string)

		if accessToken == "" {
			c.Warn("Token response missing access_token")
			return nil
		}

		c.Info("Device code approved -- token acquired.")

		// Step 5: Extract claims from id_token.
		var claims map[string]any
		if idToken != "" {
			claims = validator.DecodeJWTPayload(idToken)
		}
		if claims == nil {
			claims = map[string]any{}
		}

		tenantID := stringClaim(claims, "tid", "common")
		scopeStr, _ := body["scope"].(string)
		if scopeStr == "" {
			scopeStr = c.scopes
		}
		tokenScopes := strings.Fields(scopeStr)

		tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
		tok.AccountID = stringClaim(claims, "oid", "")
		tok.Username = stringClaim(claims, "preferred_username", "")
		tok.DisplayName = stringClaim(claims, "name", "")
		tok.TenantID = tenantID
		tok.AccessToken = types.Secure(accessToken)
		tok.RefreshToken = types.Secure(refreshToken)
		tok.ClientID = clientID
		tok.TokenURI = tokenURL
		tok.Scopes = tokenScopes
		tok.FOCI = true

		// Extra metadata.
		tok.Extra["client_name"] = c.clientName
		tok.Extra["token_type"], _ = body["token_type"].(string)
		tok.Extra["foci_clients"] = FOCIClients

		idClaims := make(map[string]any)
		for _, k := range []string{"oid", "tid", "preferred_username", "name", "upn"} {
			if v, ok := claims[k]; ok {
				idClaims[k] = v
			}
		}
		tok.Extra["id_token_claims"] = idClaims

		return []*types.CollectedToken{tok}
	}

	c.Warn("Timed out waiting for device code approval.")
	return nil
}

// Refresh exchanges a FOCI refresh token for new access + refresh tokens.
func (c *FOCIDeviceCodeCollector) Refresh(token *types.CollectedToken) *types.RefreshResult {
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
		clientID = FOCIClients[defaultFOCIClient]
	}
	tenantID := token.TenantID
	if tenantID == "" {
		tenantID = defaultFOCITenant
	}
	tokenURL := token.TokenURI
	if tokenURL == "" {
		tokenURL = fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)
	}

	body, httpErr, _ := postFormRaw(tokenURL, url.Values{
		"client_id":     {clientID},
		"refresh_token": {token.RefreshToken.Value()},
		"grant_type":    {"refresh_token"},
		"scope":         {defaultFOCIScopes},
	})

	if httpErr != nil {
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   fmt.Sprintf("Refresh request failed: %v", httpErr),
		}
	}

	accessToken, _ := body["access_token"].(string)
	if accessToken == "" {
		desc, _ := body["error_description"].(string)
		if desc == "" {
			desc = "Refresh returned no access_token"
		}
		return &types.RefreshResult{
			Success: false,
			Service: c.Svc,
			Source:  c.Src,
			Error:   desc,
		}
	}

	idToken, _ := body["id_token"].(string)
	var claims map[string]any
	if idToken != "" {
		claims = validator.DecodeJWTPayload(idToken)
	}
	if claims == nil {
		claims = map[string]any{}
	}

	scopeStr, _ := body["scope"].(string)
	if scopeStr == "" {
		scopeStr = defaultFOCIScopes
	}
	tokenScopes := strings.Fields(scopeStr)

	newRefresh, _ := body["refresh_token"].(string)
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
	newTok.Extra["token_type"], _ = body["token_type"].(string)
	newTok.Extra["foci_clients"] = FOCIClients

	return &types.RefreshResult{
		Success:  true,
		Service:  c.Svc,
		Source:   c.Src,
		NewToken: newTok,
	}
}

// resolveClientID maps a FOCI client alias to its UUID, or returns the
// raw value if it looks like a UUID already.
func (c *FOCIDeviceCodeCollector) resolveClientID() string {
	if id, ok := FOCIClients[c.clientName]; ok {
		return id
	}
	return c.clientName
}

// -- HTTP helpers -----------------------------------------------------------

var fociHTTPClient = &http.Client{Timeout: 30 * time.Second}

// postForm sends a form POST and returns the parsed JSON body.
func postForm(endpoint string, data url.Values) (map[string]any, error) {
	resp, err := fociHTTPClient.PostForm(endpoint, data)
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
	return result, nil
}

// postFormRaw sends a form POST and returns (parsed JSON on success, error, raw body on error).
// This allows callers to inspect error response bodies for OAuth error codes.
func postFormRaw(endpoint string, data url.Values) (map[string]any, error, []byte) {
	resp, err := fociHTTPClient.PostForm(endpoint, data)
	if err != nil {
		return nil, err, nil
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err, nil
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode), raw
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("JSON decode: %w", err), raw
	}
	return result, nil, nil
}

// stringClaim extracts a string claim from a JWT claims map, with fallback.
func stringClaim(claims map[string]any, key, fallback string) string {
	if v, ok := claims[key].(string); ok && v != "" {
		return v
	}
	return fallback
}

// stringClaimFallback extracts a string claim from a JWT claims map,
// falling back to the provided default value.
func stringClaimFallback(claims map[string]any, key string, fallback string) string {
	if v, ok := claims[key].(string); ok && v != "" {
		return v
	}
	return fallback
}
