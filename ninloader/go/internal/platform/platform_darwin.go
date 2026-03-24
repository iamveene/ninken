//go:build darwin

package platform

import "os"

func ConfigDir() string {
	return join(HomeDir(), "Library", "Application Support")
}

func ChromeUserDataDir() string {
	return join(HomeDir(), "Library", "Application Support", "Google", "Chrome")
}

func EdgeUserDataDir() string {
	return join(HomeDir(), "Library", "Application Support", "Microsoft Edge")
}

func TeamsDataDir() string {
	// Check for new Teams first, then classic
	newTeams := join(HomeDir(), "Library", "Application Support", "Microsoft", "MSTeams")
	if _, err := os.Stat(newTeams); err == nil {
		return newTeams
	}
	return join(HomeDir(), "Library", "Application Support", "Microsoft", "Teams")
}

func SlackDataDir() string {
	return join(HomeDir(), "Library", "Application Support", "Slack")
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
