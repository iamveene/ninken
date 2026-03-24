//go:build windows

package platform

import "os"

func localAppData() string {
	if v := os.Getenv("LOCALAPPDATA"); v != "" {
		return v
	}
	return join(HomeDir(), "AppData", "Local")
}

func appData() string {
	if v := os.Getenv("APPDATA"); v != "" {
		return v
	}
	return join(HomeDir(), "AppData", "Roaming")
}

func ConfigDir() string {
	return appData()
}

func ChromeUserDataDir() string {
	return join(localAppData(), "Google", "Chrome", "User Data")
}

func EdgeUserDataDir() string {
	return join(localAppData(), "Microsoft", "Edge", "User Data")
}

func TeamsDataDir() string {
	return join(appData(), "Microsoft", "Teams")
}

func SlackDataDir() string {
	return join(appData(), "Slack")
}

func GcloudDir() string {
	if v := os.Getenv("CLOUDSDK_CONFIG"); v != "" {
		return v
	}
	return join(appData(), "gcloud")
}

func GhCliDir() string {
	return join(appData(), "GitHub CLI")
}

func GlabConfigPath() string {
	return join(appData(), "glab-cli", "config.yml")
}

func NetrcPath() string {
	return join(HomeDir(), "_netrc")
}
