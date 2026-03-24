package cmd

import (
	"fmt"

	"github.com/ninken/ninloader-go/internal/discovery"
	"github.com/spf13/cobra"
)

var discoverCmd = &cobra.Command{
	Use:   "discover",
	Short: "Discover available token sources",
	Run: func(cmd *cobra.Command, args []string) {
		printBanner()

		service, _ := cmd.Flags().GetString("service")
		jsonOutput, _ := cmd.Flags().GetBool("json")

		engine := &discovery.Engine{}
		tokens := engine.Run(service)

		if jsonOutput {
			fmt.Println(engine.FormatJSON(tokens))
		} else {
			fmt.Print(engine.FormatTable(tokens))
		}
	},
}

func init() {
	discoverCmd.Flags().String("service", "", "Filter by service (aws, google, github, microsoft, slack, gitlab, chrome)")
	discoverCmd.Flags().Bool("json", false, "Output as JSON")
	rootCmd.AddCommand(discoverCmd)
}
