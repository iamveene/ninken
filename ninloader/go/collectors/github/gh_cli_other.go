//go:build !darwin

package github

// readKeychain is a no-op stub on non-macOS platforms.
func (c *GhCliCollector) readKeychain(host string) string { return "" }
