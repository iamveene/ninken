package types

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Version is the NinLoader wire format version.
const Version = "1.0"

// SecureString wraps a credential string to prevent accidental log leakage.
// String() returns "<REDACTED>". Use Value() for the actual string.
type SecureString struct {
	value string
}

func NewSecureString(s string) *SecureString { return &SecureString{value: s} }
func (s *SecureString) Value() string {
	if s == nil {
		return ""
	}
	return s.value
}
func (s *SecureString) String() string  { return "<REDACTED>" }
func (s *SecureString) IsEmpty() bool   { return s == nil || s.value == "" }
func (s *SecureString) GoString() string { return "<REDACTED>" }
func (s *SecureString) MarshalJSON() ([]byte, error) {
	if s == nil {
		return json.Marshal(nil)
	}
	return json.Marshal(s.value)
}

// Secure wraps a plaintext string as a SecureString. Returns nil for empty strings.
func Secure(s string) *SecureString {
	if s == "" {
		return nil
	}
	return NewSecureString(s)
}

// DiscoveredToken is a token source found but not yet extracted.
type DiscoveredToken struct {
	Service      string
	Source       string
	Path         string
	AccountHint  string
	StealthScore int
	Details      string
}

func (d *DiscoveredToken) Summary() string {
	parts := []string{fmt.Sprintf("[%s/%s]", d.Service, d.Source)}
	if d.AccountHint != "" {
		parts = append(parts, d.AccountHint)
	}
	if d.Path != "" {
		parts = append(parts, fmt.Sprintf("@ %s", d.Path))
	}
	if d.Details != "" {
		parts = append(parts, fmt.Sprintf("(%s)", d.Details))
	}
	parts = append(parts, fmt.Sprintf("stealth=%d", d.StealthScore))
	return strings.Join(parts, " ")
}

// CollectedToken is a fully extracted token ready for output.
type CollectedToken struct {
	Service      string
	Source       string
	StealthScore int
	CollectedAt  time.Time

	// Account identification
	AccountID   string
	Username    string
	DisplayName string
	TenantID    string
	TenantName  string

	// Token material
	AccessToken  *SecureString
	RefreshToken *SecureString
	ClientID     string
	ClientSecret *SecureString
	TokenURI     string
	Scopes       []string
	ExpiresAt    string

	// Microsoft FOCI flag
	FOCI bool

	// Extra provider-specific data
	Extra map[string]any
}

// NewCollectedToken creates a CollectedToken with CollectedAt set to now UTC.
func NewCollectedToken(service, source string, stealthScore int) *CollectedToken {
	return &CollectedToken{
		Service:      service,
		Source:       source,
		StealthScore: stealthScore,
		CollectedAt:  time.Now().UTC(),
		Extra:        make(map[string]any),
	}
}

// ToNinkenDict produces the canonical Ninken wire format.
func (t *CollectedToken) ToNinkenDict() map[string]any {
	var accessToken, refreshToken, clientSecret any
	if t.AccessToken != nil {
		accessToken = t.AccessToken.Value()
	}
	if t.RefreshToken != nil {
		refreshToken = t.RefreshToken.Value()
	}
	if t.ClientSecret != nil {
		clientSecret = t.ClientSecret.Value()
	}

	extra := t.Extra
	if extra == nil {
		extra = make(map[string]any)
	}

	return map[string]any{
		"ninloader_version": Version,
		"collected_at":      t.CollectedAt.Format(time.RFC3339),
		"collector": map[string]any{
			"service":       t.Service,
			"source":        t.Source,
			"stealth_score": t.StealthScore,
		},
		"account": map[string]any{
			"id":           nilIfEmpty(t.AccountID),
			"username":     nilIfEmpty(t.Username),
			"display_name": nilIfEmpty(t.DisplayName),
			"tenant_id":    nilIfEmpty(t.TenantID),
			"tenant_name":  nilIfEmpty(t.TenantName),
		},
		"token": map[string]any{
			"platform":      t.Service,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"client_id":     nilIfEmpty(t.ClientID),
			"client_secret": clientSecret,
			"token_uri":     nilIfEmpty(t.TokenURI),
			"scopes":        t.Scopes,
			"expires_at":    nilIfEmpty(t.ExpiresAt),
			"foci":          t.FOCI,
			"extra":         extra,
		},
	}
}

// ToJSON serializes to JSON with plaintext token values.
func (t *CollectedToken) ToJSON(indent bool) ([]byte, error) {
	d := t.ToNinkenDict()
	if indent {
		return json.MarshalIndent(d, "", "  ")
	}
	return json.Marshal(d)
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ValidationResult is the result of validating a token.
type ValidationResult struct {
	Valid       bool
	Service     string
	Source      string
	AccountHint string
	ExpiresAt   string
	Expired     bool
	Error       string
}

func (r *ValidationResult) Summary() string {
	status := "VALID"
	if !r.Valid {
		status = "INVALID"
	}
	if r.Expired {
		status = "EXPIRED"
	}
	parts := []string{fmt.Sprintf("[%s] %s/%s", status, r.Service, r.Source)}
	if r.AccountHint != "" {
		parts = append(parts, r.AccountHint)
	}
	if r.ExpiresAt != "" {
		parts = append(parts, fmt.Sprintf("expires=%s", r.ExpiresAt))
	}
	if r.Error != "" {
		parts = append(parts, fmt.Sprintf("error=%s", r.Error))
	}
	return strings.Join(parts, " ")
}

// RefreshResult is the result of refreshing a token.
type RefreshResult struct {
	Success  bool
	Service  string
	Source   string
	NewToken *CollectedToken
	Error    string
}

func (r *RefreshResult) Summary() string {
	status := "OK"
	if !r.Success {
		status = "FAIL"
	}
	parts := []string{fmt.Sprintf("[%s] %s/%s", status, r.Service, r.Source)}
	if r.Error != "" {
		parts = append(parts, fmt.Sprintf("error=%s", r.Error))
	}
	return strings.Join(parts, " ")
}
