//go:build linux

package platform

import (
	"os"
	"path/filepath"
)

func ConfigDir() string {
	if v := os.Getenv("XDG_CONFIG_HOME"); v != "" {
		return v
	}
	return filepath.Join(HomeDir(), ".config")
}

func ChromeUserDataDir() string {
	return filepath.Join(HomeDir(), ".config", "google-chrome")
}

func EdgeUserDataDir() string {
	return filepath.Join(HomeDir(), ".config", "microsoft-edge")
}

func TeamsDataDir() string {
	return filepath.Join(HomeDir(), ".config", "Microsoft", "Microsoft Teams")
}

func SlackDataDir() string {
	return filepath.Join(HomeDir(), ".config", "Slack")
}

func GcloudDir() string {
	if v := os.Getenv("CLOUDSDK_CONFIG"); v != "" {
		return v
	}
	return filepath.Join(HomeDir(), ".config", "gcloud")
}

func GhCliDir() string {
	return filepath.Join(HomeDir(), ".config", "gh")
}

func GlabConfigPath() string {
	return filepath.Join(HomeDir(), ".config", "glab-cli", "config.yml")
}

func NetrcPath() string {
	return filepath.Join(HomeDir(), ".netrc")
}
