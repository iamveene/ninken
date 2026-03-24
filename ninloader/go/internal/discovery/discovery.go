// Package discovery scans all registered collectors for available token sources.
package discovery

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// Engine iterates all registered collectors and runs Discover() on each.
type Engine struct{}

// Run executes discovery across all (or filtered) collectors.
// Returns a list of DiscoveredToken for every token source found.
// If serviceFilter is non-empty, only collectors matching that service are run.
func (e *Engine) Run(serviceFilter string) []*types.DiscoveredToken {
	var results []*types.DiscoveredToken

	var collectors []interface {
		Service() string
		Source() string
		IsPlatformSupported() bool
		Discover() []*types.DiscoveredToken
	}

	if serviceFilter != "" {
		for _, c := range registry.AllForService(serviceFilter) {
			collectors = append(collectors, c)
		}
	} else {
		for _, c := range registry.All() {
			collectors = append(collectors, c)
		}
	}

	for _, c := range collectors {
		if !c.IsPlatformSupported() {
			continue
		}

		discovered := safeDiscover(c)
		results = append(results, discovered...)
	}

	return results
}

// safeDiscover calls Discover() on a collector, recovering from panics.
func safeDiscover(c interface {
	Discover() []*types.DiscoveredToken
}) (results []*types.DiscoveredToken) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[WARN] collector panic in discover: %v\n", r)
			results = nil
		}
	}()
	return c.Discover()
}

// FormatTable produces a human-readable table with columns:
// Service, Source, Stealth, Account, Path (Details).
func (e *Engine) FormatTable(tokens []*types.DiscoveredToken) string {
	if len(tokens) == 0 {
		return "No token sources discovered."
	}

	var b strings.Builder
	fmt.Fprintf(&b, "%-12s %-20s %-8s %-30s %s\n", "Service", "Source", "Stealth", "Account", "Path")
	b.WriteString(strings.Repeat("-", 100))
	b.WriteByte('\n')

	for _, t := range tokens {
		acct := t.AccountHint
		path := t.Path
		details := ""
		if t.Details != "" {
			details = fmt.Sprintf(" (%s)", t.Details)
		}
		fmt.Fprintf(&b, "%-12s %-20s %-8d %-30s %s%s\n", t.Service, t.Source, t.StealthScore, acct, path, details)
	}

	fmt.Fprintf(&b, "\nTotal: %d token source(s) found", len(tokens))
	return b.String()
}

// FormatJSON serializes the discovered tokens as a JSON array.
func (e *Engine) FormatJSON(tokens []*types.DiscoveredToken) string {
	data := make([]map[string]any, len(tokens))
	for i, t := range tokens {
		data[i] = map[string]any{
			"service":       t.Service,
			"source":        t.Source,
			"path":          t.Path,
			"account_hint":  t.AccountHint,
			"stealth_score": t.StealthScore,
			"details":       t.Details,
		}
	}

	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "[]"
	}
	return string(b)
}
