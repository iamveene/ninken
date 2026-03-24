//go:build windows

package microsoft

import (
	"os"
	"path/filepath"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

func init() {
	registry.Register("microsoft", "dpapi", func() collector.Collector {
		return &DPAPICollector{BaseCollector: collector.BaseCollector{Svc: "microsoft", Src: "dpapi", Plats: []string{"windows"}}}
	})
}

// DPAPICollector discovers DPAPI-protected MSAL token caches on Windows.
type DPAPICollector struct {
	collector.BaseCollector
}

func (c *DPAPICollector) Service() string    { return c.Svc }
func (c *DPAPICollector) Source() string      { return c.Src }
func (c *DPAPICollector) StealthScore() int   { return 4 }
func (c *DPAPICollector) Platforms() []string { return c.Plats }

func (c *DPAPICollector) Discover() []*types.DiscoveredToken {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return nil
	}

	msalCache := filepath.Join(localAppData, "Microsoft", "TokenBroker", "Cache")
	if info, err := os.Stat(msalCache); err != nil || !info.IsDir() {
		return nil
	}

	return []*types.DiscoveredToken{
		{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         msalCache,
			StealthScore: c.StealthScore(),
			Details:      "DPAPI-protected MSAL token cache",
		},
	}
}

func (c *DPAPICollector) Collect() []*types.CollectedToken {
	c.Warn("DPAPI token extraction not yet implemented")
	return nil
}
