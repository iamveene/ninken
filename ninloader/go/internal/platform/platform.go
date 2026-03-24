package platform

import (
	"os"
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
	return join(HomeDir(), ".aws")
}

// GitCredentialsPath returns the path to ~/.git-credentials.
func GitCredentialsPath() string {
	return join(HomeDir(), ".git-credentials")
}

// join is a simple path joiner using os.PathSeparator.
func join(parts ...string) string {
	sep := string(os.PathSeparator)
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
