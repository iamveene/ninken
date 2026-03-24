package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	// Version is set via ldflags at build time.
	Version = "1.0.0-dev"

	quiet bool
)

const banner = `
  _   _ _       _                    _
 | \ | (_)_ __ | |    ___   __ _  __| | ___ _ __
 |  \| | | '_ \| |   / _ \ / _` + "`" + ` |/ _` + "`" + ` |/ _ \ '__|
 | |\  | | | | | |__| (_) | (_| | (_| |  __/ |
 |_| \_|_|_| |_|_____\___/ \__,_|\__,_|\___|_|
                                        v%s
 Universal Token Collector — Ninken Red Team Platform
`

var rootCmd = &cobra.Command{
	Use:   "ninloader",
	Short: "NinLoader — Universal Token Collector CLI",
	Long:  "NinLoader collects authentication tokens from cloud services for the Ninken red team platform.",
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&quiet, "quiet", "q", false, "Suppress banner and info messages")
	rootCmd.Version = Version
}

func Execute(version string) {
	Version = version
	rootCmd.Version = version
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func printBanner() {
	if !quiet {
		fmt.Fprintf(os.Stderr, banner, Version)
	}
}
