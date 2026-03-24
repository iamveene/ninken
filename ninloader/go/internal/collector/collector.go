package collector

import (
	"fmt"
	"os"
	"runtime"

	"github.com/ninken/ninloader-go/internal/types"
)

// Collector is the interface all collectors must implement.
type Collector interface {
	Service() string
	Source() string
	StealthScore() int
	Platforms() []string
	IsPlatformSupported() bool
	Discover() []*types.DiscoveredToken
	Collect() []*types.CollectedToken
	Refresh(token *types.CollectedToken) *types.RefreshResult
}

// ConfigurableCollector is an optional interface for collectors that accept CLI options.
type ConfigurableCollector interface {
	Collector
	Configure(opts CollectOptions)
}

// CollectOptions holds CLI options passed to configurable collectors.
type CollectOptions struct {
	Account      string
	TenantID     string
	ClientName   string
	Scopes       string
	ClientSecret string
}

// BaseCollector provides default implementations for Collector methods.
// Embed it in every concrete collector.
type BaseCollector struct {
	Svc string
	Src string
}

func (b *BaseCollector) IsPlatformSupported() bool {
	platforms := b.CollectorPlatforms()
	if len(platforms) == 0 {
		return true
	}
	for _, p := range platforms {
		if p == runtime.GOOS {
			return true
		}
	}
	return false
}

// CollectorPlatforms returns nil (all platforms). Override in concrete collectors.
// This exists because Platforms() must be defined on the concrete type, not BaseCollector.
func (b *BaseCollector) CollectorPlatforms() []string {
	return nil
}

func (b *BaseCollector) Refresh(token *types.CollectedToken) *types.RefreshResult {
	return &types.RefreshResult{
		Success: false,
		Service: b.Svc,
		Source:  b.Src,
		Error:   "refresh not implemented for this collector",
	}
}

func (b *BaseCollector) Warn(msg string) {
	fmt.Fprintf(os.Stderr, "[WARN] [%s/%s] %s\n", b.Svc, b.Src, msg)
}

func (b *BaseCollector) Info(msg string) {
	fmt.Fprintf(os.Stderr, "[INFO] [%s/%s] %s\n", b.Svc, b.Src, msg)
}
