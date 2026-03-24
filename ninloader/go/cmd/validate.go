package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ninken/ninloader-go/internal/types"
	"github.com/ninken/ninloader-go/internal/validator"
	"github.com/spf13/cobra"
)

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate tokens from a JSON file",
	Run: func(cmd *cobra.Command, args []string) {
		printBanner()

		file, _ := cmd.Flags().GetString("file")

		data, err := os.ReadFile(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading %s: %s\n", file, err)
			os.Exit(1)
		}

		var entries []map[string]any

		// Try array first, then single object
		if err := json.Unmarshal(data, &entries); err != nil {
			var single map[string]any
			if err := json.Unmarshal(data, &single); err != nil {
				fmt.Fprintf(os.Stderr, "Error parsing %s: %s\n", file, err)
				os.Exit(1)
			}
			entries = []map[string]any{single}
		}

		for _, entry := range entries {
			token := entryToToken(entry)
			result := validator.ValidateToken(token)
			fmt.Println(result.Summary())
		}
	},
}

func entryToToken(entry map[string]any) *types.CollectedToken {
	tokenData := mapGet(entry, "token", entry)
	accountData := mapGet(entry, "account", map[string]any{})
	collectorData := mapGet(entry, "collector", map[string]any{})

	service := strOr(collectorData, "service", strOr(tokenData, "platform", "unknown"))
	source := strOr(collectorData, "source", "file")

	token := types.NewCollectedToken(service, source, 5)
	token.Username = strVal(accountData, "username")
	token.TenantID = strVal(accountData, "tenant_id")

	if v := strVal(tokenData, "access_token"); v != "" {
		token.AccessToken = types.Secure(v)
	}
	if v := strVal(tokenData, "refresh_token"); v != "" {
		token.RefreshToken = types.Secure(v)
	}
	token.ClientID = strVal(tokenData, "client_id")
	if v := strVal(tokenData, "client_secret"); v != "" {
		token.ClientSecret = types.Secure(v)
	}
	token.TokenURI = strVal(tokenData, "token_uri")
	token.ExpiresAt = strVal(tokenData, "expires_at")

	if scopes, ok := tokenData["scopes"].([]any); ok {
		for _, s := range scopes {
			if str, ok := s.(string); ok {
				token.Scopes = append(token.Scopes, str)
			}
		}
	}

	if foci, ok := tokenData["foci"].(bool); ok {
		token.FOCI = foci
	}

	return token
}

func mapGet(m map[string]any, key string, fallback map[string]any) map[string]any {
	if v, ok := m[key].(map[string]any); ok {
		return v
	}
	return fallback
}

func strVal(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func strOr(m map[string]any, key, fallback string) string {
	if v := strVal(m, key); v != "" {
		return v
	}
	return fallback
}

func init() {
	validateCmd.Flags().String("file", "", "Path to token JSON file")
	_ = validateCmd.MarkFlagRequired("file")
	rootCmd.AddCommand(validateCmd)
}
