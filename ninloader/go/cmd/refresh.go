package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ninken/ninloader-go/internal/output"
	"github.com/ninken/ninloader-go/internal/refresh"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/spf13/cobra"
)

var refreshCmd = &cobra.Command{
	Use:   "refresh",
	Short: "Refresh tokens from a JSON file",
	Run: func(cmd *cobra.Command, args []string) {
		printBanner()

		file, _ := cmd.Flags().GetString("file")
		outputType, _ := cmd.Flags().GetString("output")
		path, _ := cmd.Flags().GetString("path")

		data, err := os.ReadFile(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading %s: %s\n", file, err)
			os.Exit(1)
		}

		var entries []map[string]any
		if err := json.Unmarshal(data, &entries); err != nil {
			var single map[string]any
			if err := json.Unmarshal(data, &single); err != nil {
				fmt.Fprintf(os.Stderr, "Error parsing %s: %s\n", file, err)
				os.Exit(1)
			}
			entries = []map[string]any{single}
		}

		var refreshed []*types.CollectedToken

		for _, entry := range entries {
			token := entryToToken(entry)
			result := refresh.RefreshToken(token)
			fmt.Fprintln(os.Stderr, result.Summary())
			if result.Success && result.NewToken != nil {
				refreshed = append(refreshed, result.NewToken)
			}
		}

		if len(refreshed) > 0 {
			handler, err := output.GetHandler(outputType, path, "")
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %s\n", err)
				os.Exit(1)
			}
			if err := handler.Write(refreshed); err != nil {
				fmt.Fprintf(os.Stderr, "Error writing output: %s\n", err)
				os.Exit(1)
			}
		}
	},
}

func init() {
	refreshCmd.Flags().String("file", "", "Path to token JSON file")
	_ = refreshCmd.MarkFlagRequired("file")
	refreshCmd.Flags().String("output", "stdout", "Output destination for refreshed tokens")
	refreshCmd.Flags().String("path", "", "Output directory for file output")
	rootCmd.AddCommand(refreshCmd)
}
