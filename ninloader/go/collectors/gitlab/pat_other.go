//go:build !darwin

package gitlab

// readKeychain is a no-op stub on non-macOS platforms.
func (c *PatCollector) readKeychain(host string) string { return "" }
