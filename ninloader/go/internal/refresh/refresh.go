// Package refresh dispatches token refresh requests to the appropriate collector.
package refresh

import (
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// RefreshToken attempts to refresh a collected token using the appropriate collector.
// It looks up the collector by (service, source) and delegates to its Refresh() method.
func RefreshToken(token *types.CollectedToken) *types.RefreshResult {
	c := registry.Get(token.Service, token.Source)
	if c == nil {
		return &types.RefreshResult{
			Success: false,
			Service: token.Service,
			Source:  token.Source,
			Error:   "no collector found for " + token.Service + "/" + token.Source,
		}
	}

	if !c.IsPlatformSupported() {
		return &types.RefreshResult{
			Success: false,
			Service: token.Service,
			Source:  token.Source,
			Error:   "collector " + token.Service + "/" + token.Source + " not supported on this platform",
		}
	}

	defer func() {
		// If the collector's Refresh() panics, we return an error result.
		// The named return is handled by the outer function; this is a safety net.
	}()

	return safeRefresh(c, token)
}

// safeRefresh calls Refresh() on a collector, recovering from panics.
func safeRefresh(c interface {
	Refresh(token *types.CollectedToken) *types.RefreshResult
}, token *types.CollectedToken) (result *types.RefreshResult) {
	defer func() {
		if r := recover(); r != nil {
			result = &types.RefreshResult{
				Success: false,
				Service: token.Service,
				Source:  token.Source,
				Error:   "panic during refresh: " + formatPanic(r),
			}
		}
	}()
	return c.Refresh(token)
}

// formatPanic converts a recovered panic value to a string.
func formatPanic(r any) string {
	switch v := r.(type) {
	case string:
		return v
	case error:
		return v.Error()
	default:
		return "unknown panic"
	}
}
