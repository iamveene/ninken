//go:build linux

package platform

import "os"

func ConfigDir() string {
	if v := os.Getenv("XDG_CONFIG_HOME"); v != "" {
		return v
	}
	return join(HomeDir(), ".config")
}

func ChromeUserDataDir() string {
	return join(HomeDir(), ".config", "google-chrome")
}

func EdgeUserDataDir() string {
	return join(HomeDir(), ".config", "microsoft-edge")
}

func TeamsDataDir() string {
	return join(HomeDir(), ".config", "Microsoft", "Microsoft Teams")
}

func SlackDataDir() string {
	return join(HomeDir(), ".config", "Slack")
}

func GcloudDir() string {
	if v := os.Getenv("CLOUDSDK_CONFIG"); v != "" {
		return v
	}
	return join(HomeDir(), ".config", "gcloud")
}

func GhCliDir() string {
	return join(HomeDir(), ".config", "gh")
}

func GlabConfigPath() string {
	return join(HomeDir(), ".config", "glab-cli", "config.yml")
}

func NetrcPath() string {
	return join(HomeDir(), ".netrc")
}
