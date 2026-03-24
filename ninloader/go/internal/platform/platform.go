package platform

import (
	"os"
	"path/filepath"
	"runtime"
)

// Platform returns the normalized platform: "darwin", "windows", or "linux".
func Platform() string {
	return runtime.GOOS
}

// HomeDir returns the user's home directory.
func HomeDir() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return h
}

// AWSDir returns the AWS config/credentials directory.
func AWSDir() string {
	return filepath.Join(HomeDir(), ".aws")
}

// GitCredentialsPath returns the path to ~/.git-credentials.
func GitCredentialsPath() string {
	return filepath.Join(HomeDir(), ".git-credentials")
}
