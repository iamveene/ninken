package main

import (
	"github.com/ninken/ninloader-go/cmd"

	// Import all collector packages to trigger init() registration
	_ "github.com/ninken/ninloader-go/collectors/aws"
	_ "github.com/ninken/ninloader-go/collectors/chrome"
	_ "github.com/ninken/ninloader-go/collectors/github"
	_ "github.com/ninken/ninloader-go/collectors/gitlab"
	_ "github.com/ninken/ninloader-go/collectors/google"
	_ "github.com/ninken/ninloader-go/collectors/microsoft"
	_ "github.com/ninken/ninloader-go/collectors/slack"
)

// Version is set via ldflags at build time.
var Version = "1.0.0-dev"

func main() {
	cmd.Execute(Version)
}
