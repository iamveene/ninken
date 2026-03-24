package validator

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/ninken/ninloader-go/internal/types"
)

// DecodeJWTPayload decodes a JWT without signature verification.
// Returns nil if not a valid JWT.
func DecodeJWTPayload(token string) map[string]any {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(payload, &result); err != nil {
		return nil
	}
	return result
}

// CheckExpiry checks if a token is expired.
// Returns (expired, expiresAt string).
func CheckExpiry(token *types.CollectedToken) (bool, string) {
	now := time.Now().UTC()

	// Check explicit expires_at
	if token.ExpiresAt != "" {
		expDt, err := time.Parse(time.RFC3339, token.ExpiresAt)
		if err != nil {
			// Try ISO format without timezone
			expDt, err = time.Parse("2006-01-02T15:04:05", token.ExpiresAt)
		}
		if err == nil {
			return expDt.Before(now), token.ExpiresAt
		}
	}

	// Try JWT exp claim from access_token
	if token.AccessToken != nil && !token.AccessToken.IsEmpty() {
		payload := DecodeJWTPayload(token.AccessToken.Value())
		if payload != nil {
			if exp, ok := payload["exp"].(float64); ok {
				expTime := time.Unix(int64(exp), 0).UTC()
				return expTime.Before(now), expTime.Format(time.RFC3339)
			}
		}
	}

	return false, ""
}

// ValidateToken checks structure and expiry.
func ValidateToken(token *types.CollectedToken) *types.ValidationResult {
	hasAccess := token.AccessToken != nil && !token.AccessToken.IsEmpty()
	hasRefresh := token.RefreshToken != nil && !token.RefreshToken.IsEmpty()
	hasSecret := token.ClientSecret != nil && !token.ClientSecret.IsEmpty()

	if !hasAccess && !hasRefresh && !hasSecret {
		return &types.ValidationResult{
			Valid:       false,
			Service:     token.Service,
			Source:      token.Source,
			AccountHint: token.Username,
			Error:       "No token material found",
		}
	}

	expired, expiresAt := CheckExpiry(token)

	if expired && hasRefresh {
		return &types.ValidationResult{
			Valid:       true,
			Service:     token.Service,
			Source:      token.Source,
			AccountHint: token.Username,
			ExpiresAt:   expiresAt,
			Expired:     true,
			Error:       "Access token expired but refresh token available",
		}
	}

	if expired {
		return &types.ValidationResult{
			Valid:       false,
			Service:     token.Service,
			Source:      token.Source,
			AccountHint: token.Username,
			ExpiresAt:   expiresAt,
			Expired:     true,
			Error:       "Token expired",
		}
	}

	return &types.ValidationResult{
		Valid:       true,
		Service:     token.Service,
		Source:      token.Source,
		AccountHint: token.Username,
		ExpiresAt:   expiresAt,
	}
}
