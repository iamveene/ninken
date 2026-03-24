//go:build windows

package platform

import (
	"os"
	"path/filepath"
)

func localAppData() string {
	if v := os.Getenv("LOCALAPPDATA"); v != "" {
		return v
	}
	return filepath.Join(HomeDir(), "AppData", "Local")
}

func appData() string {
	if v := os.Getenv("APPDATA"); v != "" {
		return v
	}
	return filepath.Join(HomeDir(), "AppData", "Roaming")
}

func ConfigDir() string {
	return appData()
}

func ChromeUserDataDir() string {
	return filepath.Join(localAppData(), "Google", "Chrome", "User Data")
}

func EdgeUserDataDir() string {
	return filepath.Join(localAppData(), "Microsoft", "Edge", "User Data")
}

func TeamsDataDir() string {
	return filepath.Join(appData(), "Microsoft", "Teams")
}

func SlackDataDir() string {
	return filepath.Join(appData(), "Slack")
}

func GcloudDir() string {
	if v := os.Getenv("CLOUDSDK_CONFIG"); v != "" {
		return v
	}
	return filepath.Join(appData(), "gcloud")
}

func GhCliDir() string {
	return filepath.Join(appData(), "GitHub CLI")
}

func GlabConfigPath() string {
	return filepath.Join(appData(), "glab-cli", "config.yml")
}

func NetrcPath() string {
	return filepath.Join(HomeDir(), "_netrc")
}
