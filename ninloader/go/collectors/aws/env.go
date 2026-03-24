package aws

import (
	"fmt"
	"os"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("aws", "env", func() collector.Collector {
		return &EnvCollector{BaseCollector: collector.BaseCollector{Svc: "aws", Src: "env"}}
	})
}

// EnvCollector reads AWS credentials from environment variables.
type EnvCollector struct {
	collector.BaseCollector
}

func (c *EnvCollector) Service() string            { return c.Svc }
func (c *EnvCollector) Source() string              { return c.Src }
func (c *EnvCollector) StealthScore() int           { return 5 }
func (c *EnvCollector) Platforms() []string         { return nil }
func (c *EnvCollector) IsPlatformSupported() bool   { return true }

func (c *EnvCollector) Discover() []*types.DiscoveredToken {
	keyID := os.Getenv("AWS_ACCESS_KEY_ID")
	if keyID == "" {
		return nil
	}

	hint := keyID
	if len(hint) > 8 {
		hint = hint[:8]
	}

	return []*types.DiscoveredToken{
		{
			Service:      c.Svc,
			Source:       c.Src,
			AccountHint:  fmt.Sprintf("key_id=%s...", hint),
			StealthScore: c.StealthScore(),
			Details:      "environment variable",
		},
	}
}

func (c *EnvCollector) Collect() []*types.CollectedToken {
	keyID := os.Getenv("AWS_ACCESS_KEY_ID")
	secret := os.Getenv("AWS_SECRET_ACCESS_KEY")

	if keyID == "" || secret == "" {
		return nil
	}

	session := os.Getenv("AWS_SESSION_TOKEN")
	region := os.Getenv("AWS_DEFAULT_REGION")
	if region == "" {
		region = os.Getenv("AWS_REGION")
	}

	tok := types.NewCollectedToken(c.Svc, c.Src, c.StealthScore())
	tok.AccountID = keyID

	hint := keyID
	if len(hint) > 8 {
		hint = hint[:8]
	}
	tok.Username = fmt.Sprintf("env:%s...", hint)
	tok.AccessToken = types.Secure(keyID)
	tok.ClientSecret = types.Secure(secret)

	if session != "" {
		tok.Extra["session_token"] = session
	}
	if region != "" {
		tok.Extra["region"] = region
	}

	profile := os.Getenv("AWS_PROFILE")
	if profile != "" {
		tok.Extra["profile"] = profile
	}

	return []*types.CollectedToken{tok}
}
