// Package microsoft contains collectors for Microsoft service tokens
// (Teams Desktop, macOS Keychain, Windows DPAPI).
//
// teams_desktop.go registers on all platforms via its init().
// keychain_darwin.go and dpapi_windows.go register via their own
// platform-gated init() functions.
package microsoft
