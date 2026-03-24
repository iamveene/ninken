//go:build darwin

package platform

import (
	"os"
	"path/filepath"
)

func ConfigDir() string {
	return filepath.Join(HomeDir(), "Library", "Application Support")
}

func ChromeUserDataDir() string {
	return filepath.Join(HomeDir(), "Library", "Application Support", "Google", "Chrome")
}

func EdgeUserDataDir() string {
	return filepath.Join(HomeDir(), "Library", "Application Support", "Microsoft Edge")
}

func TeamsDataDir() string {
	// Check for new Teams first, then classic
	newTeams := filepath.Join(HomeDir(), "Library", "Application Support", "Microsoft", "MSTeams")
	if _, err := os.Stat(newTeams); err == nil {
		return newTeams
	}
	return filepath.Join(HomeDir(), "Library", "Application Support", "Microsoft", "Teams")
}

func SlackDataDir() string {
	return filepath.Join(HomeDir(), "Library", "Application Support", "Slack")
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
