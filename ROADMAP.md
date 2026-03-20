# Ninken (忍犬) -- Roadmap

## Pending -- High Priority

### Docker Compose Containerization

Dockerfile and docker-compose.yml exist but need end-to-end testing. Installer script, configurable ports, environment variables for AI model selection, health checks.

```bash
# Target usage
docker compose up -d
docker compose up -d --build
docker compose logs -f workspace-ui
```

Deploy anywhere:
```bash
scp -r workspace-ui/ user@server:~/workspace-ui/
ssh user@server "cd workspace-ui && docker compose up -d"
```

No credential files needed on the server -- users upload via the browser UI.

---

### NinLoader -- Universal Token Collector CLI (v4.2)

#### Overview

NinLoader is a standalone, service-agnostic CLI tool for automated token collection across all platforms Ninken supports. Available as Python (cross-platform: Windows, macOS, Linux) and PowerShell (Windows-native for environments where Python isn't available). It replaces per-service scripts like `reauth.py` and `reauth_microsoft.py` with a single, extensible tool.

**Key principle:** NinLoader is a **collector**, not an operator. It finds, extracts, and outputs tokens -- Ninken does the rest.

#### Design Goals

1. **Service-agnostic plugin architecture** -- adding a new service means adding a collector plugin, zero core changes
2. **Granular control via arguments** -- user selects exactly what to collect, from where, and how to output
3. **Multiple output modes** -- save to file, print to stdout, pipe to clipboard, POST to running Ninken instance
4. **Zero external dependencies by default** -- core works with stdlib; optional packages unlock advanced features
5. **OPSEC-aware** -- minimal footprint, no telemetry, optional stealth modes for each collection method

#### CLI Interface

```bash
# Basic usage -- auto-detect and collect everything available
ninloader collect

# Collect specific service
ninloader collect --service microsoft
ninloader collect --service google
ninloader collect --service github
ninloader collect --service aws
ninloader collect --service slack

# Granular source selection
ninloader collect --service microsoft --source browser         # Chrome/Edge MSAL cache
ninloader collect --service microsoft --source keychain        # macOS Keychain / Windows DPAPI
ninloader collect --service microsoft --source teams-desktop   # Teams app local storage
ninloader collect --service microsoft --source device-code     # Interactive device code flow
ninloader collect --service microsoft --source all             # Try everything

ninloader collect --service google --source browser            # Chrome cookies/localStorage
ninloader collect --service google --source adc                # Application Default Credentials
ninloader collect --service google --source device-code        # OAuth device code flow
ninloader collect --service google --source gcloud-cli         # gcloud auth tokens

# Output control
ninloader collect --service microsoft --output file            # Save to ./tokens/microsoft_token.json (default)
ninloader collect --service microsoft --output stdout          # Print JSON to stdout
ninloader collect --service microsoft --output clipboard       # Copy to clipboard
ninloader collect --service microsoft --output ninken          # POST to running Ninken instance
ninloader collect --service microsoft --output file --path /custom/path/token.json

# Filtering
ninloader collect --service microsoft --account user@example.com  # Specific account
ninloader collect --service microsoft --tenant 727ed07c-...       # Specific tenant
ninloader collect --service microsoft --client teams              # Specific FOCI client
ninloader collect --service google --scopes gmail.readonly,drive  # Specific scopes

# Auth flow options (for device-code / OAuth sources)
ninloader collect --service microsoft --source device-code --tenant contoso --client teams
ninloader collect --service google --source device-code --client-secret ./client_secret.json

# Discovery mode -- show what's available without extracting
ninloader discover                                    # List all detected sessions/tokens
ninloader discover --service microsoft                # Microsoft-specific discovery
ninloader discover --json                             # Machine-readable output

# Validate existing tokens
ninloader validate --file ./tokens/microsoft_token.json
ninloader validate --file ./tokens/google_token.json

# Refresh expired tokens
ninloader refresh --file ./tokens/microsoft_token.json

# Multi-service batch collection
ninloader collect --service microsoft,google,github   # Collect all in one run

# Ninken integration
ninloader collect --service microsoft --output ninken --ninken-url http://localhost:4000
```

#### PowerShell variant (Windows)

```powershell
# Same interface, native Windows
NinLoader.ps1 -Collect -Service Microsoft -Source Browser
NinLoader.ps1 -Collect -Service Microsoft -Source DeviceCode -Tenant "contoso"
NinLoader.ps1 -Discover
NinLoader.ps1 -Collect -Service Microsoft -Output Stdout | clip
NinLoader.ps1 -Collect -Service Microsoft -Source DPAPI    # Windows DPAPI token extraction
```

#### Plugin Architecture

```
ninloader/
+-- ninloader.py              # CLI entrypoint + arg parser
+-- core/
|   +-- __init__.py
|   +-- output.py             # Output handlers (file, stdout, clipboard, ninken)
|   +-- discovery.py          # Token discovery engine
|   +-- validator.py          # Token validation (decode JWT, test API, check expiry)
|   +-- refresh.py            # Token refresh logic
+-- collectors/
|   +-- __init__.py           # Auto-discovers collector plugins
|   +-- base.py               # BaseCollector abstract class
|   +-- microsoft.py          # Microsoft 365 collector
|   |   +-- browser.py        # Chrome/Edge MSAL cache extraction
|   |   +-- keychain.py       # macOS Keychain / Windows DPAPI
|   |   +-- teams_desktop.py  # Teams desktop app tokens
|   |   +-- device_code.py    # Device code flow (interactive)
|   |   +-- __init__.py       # Registers all Microsoft sources
|   +-- google.py             # Google Workspace collector
|   |   +-- browser.py        # Chrome cookies/localStorage
|   |   +-- adc.py            # Application Default Credentials
|   |   +-- gcloud.py         # gcloud CLI token cache
|   |   +-- device_code.py    # OAuth device code flow
|   |   +-- __init__.py
|   +-- github.py             # GitHub collector
|   |   +-- gh_cli.py         # gh CLI config (~/.config/gh/hosts.yml)
|   |   +-- git_credentials.py # git credential store/cache
|   |   +-- __init__.py
|   +-- aws.py                # AWS collector
|   |   +-- credentials.py    # ~/.aws/credentials
|   |   +-- sso_cache.py      # ~/.aws/sso/cache
|   |   +-- __init__.py
|   +-- slack.py              # Slack collector
|       +-- desktop.py        # Slack desktop app tokens
|       +-- browser.py        # Browser localStorage
|       +-- __init__.py
+-- NinLoader.ps1             # PowerShell variant (standalone, no Python needed)
```

#### BaseCollector Interface

```python
class BaseCollector(ABC):
    """Every collector plugin implements this interface."""

    service: str              # "microsoft", "google", "github", etc.
    source: str               # "browser", "keychain", "device-code", etc.
    platforms: list[str]      # ["windows", "macos", "linux"]
    requires: list[str]       # Optional pip packages needed (e.g., ["msal"])
    stealth_score: int        # 1-5, how noisy this extraction method is

    @abstractmethod
    def discover(self) -> list[DiscoveredToken]:
        """Find available tokens without extracting. Returns metadata only."""

    @abstractmethod
    def collect(self, **kwargs) -> list[CollectedToken]:
        """Extract tokens. kwargs from CLI args (account, tenant, scopes, etc.)."""

    @abstractmethod
    def validate(self, token: CollectedToken) -> ValidationResult:
        """Test if a token is valid and what it can access."""

    @abstractmethod
    def refresh(self, token: CollectedToken) -> CollectedToken:
        """Refresh an expired token using its refresh_token."""
```

#### Token Output Format (universal)

```json
{
  "ninloader_version": "1.0",
  "collected_at": "2026-03-19T09:43:08Z",
  "collector": {
    "service": "microsoft",
    "source": "device-code",
    "stealth_score": 5
  },
  "account": {
    "id": "5825f3c9-a793-4865-9db6-8848e6e4d435",
    "username": "user@example.com",
    "display_name": "Example User",
    "tenant_id": "727ed07c-9710-40a6-a319-000000000000",
    "tenant_name": "Example Corp"
  },
  "token": {
    "platform": "microsoft",
    "access_token": "eyJ...",
    "refresh_token": "0.AVY...",
    "client_id": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    "token_uri": "https://login.microsoftonline.com/.../oauth2/v2.0/token",
    "scopes": ["Mail.ReadWrite", "Files.ReadWrite.All", "..."],
    "expires_at": "2026-03-19T10:43:08Z",
    "foci": true
  }
}
```

This format is directly ingestable by Ninken's auth endpoint -- `ninloader collect --output ninken` POSTs this to `/api/auth`.

#### Collection Sources per Service

| Service | Source | OS | Method | Stealth |
|---------|--------|----|--------|:-------:|
| **Microsoft** | `browser` | All | Chrome/Edge MSAL localStorage | 5/5 |
| | `keychain` | macOS | Keychain `com.microsoft.oneauth.*` | 4/5 |
| | `dpapi` | Windows | TokenBroker cache DPAPI decrypt | 4/5 |
| | `teams-desktop` | All | Teams SQLite/LevelDB | 5/5 |
| | `device-code` | All | Interactive device code flow | 3/5 |
| **Google** | `browser` | All | Chrome cookies + localStorage | 5/5 |
| | `adc` | All | `~/.config/gcloud/application_default_credentials.json` | 5/5 |
| | `gcloud` | All | `~/.config/gcloud/credentials.db` | 5/5 |
| | `device-code` | All | OAuth installed app flow | 3/5 |
| **GitHub** | `gh-cli` | All | `~/.config/gh/hosts.yml` | 5/5 |
| | `git-credentials` | All | git credential store/cache | 5/5 |
| | `browser` | All | GitHub session cookies | 5/5 |
| **AWS** | `credentials` | All | `~/.aws/credentials` | 5/5 |
| | `sso-cache` | All | `~/.aws/sso/cache/*.json` | 5/5 |
| | `env` | All | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars | 5/5 |
| **Slack** | `desktop` | All | Slack app local storage | 5/5 |
| | `browser` | All | Slack web session cookies | 5/5 |

#### Dependencies

**Core (stdlib only, zero-install):**
- File system token extraction (ADC, gcloud, AWS credentials, gh CLI, git credentials)
- JSON output, discovery, basic validation

**Optional (pip install for advanced features):**

| Package | When needed |
|---------|-------------|
| `msal` | Microsoft device code flow, token refresh |
| `google-auth-oauthlib` | Google device code flow |
| `cryptography` | DPAPI decryption (Windows), Keychain decryption (macOS) |
| `pysqlite3` | Teams desktop SQLite extraction |
| `requests` | `--output ninken` (POST to Ninken instance) |

NinLoader detects missing optional packages and warns gracefully:
```
[!] Source 'device-code' requires 'msal'. Install: pip install msal
    Skipping Microsoft device-code collection. Other sources will proceed.
```

#### Relationship to Ninken

- NinLoader is a **standalone tool** -- works without Ninken running
- NinLoader outputs tokens in Ninken-compatible format
- `--output ninken` directly loads tokens into a running Ninken instance
- NinLoader replaces `reauth.py` and `reauth_microsoft.py` with one unified tool
- NinLoader can be distributed as a single `.py` file or as a pip package

#### PowerShell Implementation Notes

The PowerShell variant (`NinLoader.ps1`) is a single-file script for Windows environments where Python may not be available. It covers:
- Windows DPAPI token extraction (TokenBroker cache, Teams, Edge/Chrome cookies)
- Windows Credential Manager (`vaultcmd` / `cmdkey`)
- AWS/GitHub/Slack file-based extraction
- Device code flows via native `Invoke-RestMethod`
- No external module dependencies

---

### AWS Module (v5.0)

Access key + secret key credential support. Services: S3 (bucket browser, object download), IAM (users, roles, policies, access keys), Lambda (functions, invocations), EC2 (instances, security groups), CloudTrail (event history, trail config), Secrets Manager (secret enumeration, value retrieval).

Audit mode: IAM policy analysis, public S3 buckets, unused access keys, privilege escalation paths, cross-account roles.

---

### Slack API Token Support

Add `xoxb-` (bot) and `xoxp-` (user) API token support alongside the existing browser session flow (`xoxc-` + `d` cookie). API tokens are high OpSec (5/5 Ghost) compared to browser session tokens (low OpSec, SOC-detectable). Auto-detect token type on paste.

---

## Pending -- Medium Priority

### Microsoft 365 Phase 2 (v4.1)

Advanced token flows beyond OAuth2 refresh tokens:
- **PRT exchange** -- extract PRT from non-TPM devices, derive refresh token, exchange for Graph API access
- **PRT cookie injection** -- inject `x-ms-RefreshTokenCredential` into browser SSO flow, capture access token
- **Browser session cookies** -- use `ESTSAUTHPERSISTENT` for silent auth to obtain Graph access tokens
- **FOCI deep integration** -- automatic cross-app pivot when FOCI token detected
- **SharePoint** -- sites, document libraries, lists via Graph API `/sites`

Token input formats for Phase 2:
- PRT: `{ platform: "microsoft", token_type: "prt", prt: "...", session_key: "...", tenant_id: "..." }`
- PRT cookie: `{ platform: "microsoft", token_type: "prt_cookie", prt_cookie: "...", tenant_id: "..." }`
- Browser session: `{ platform: "microsoft", token_type: "browser_session", estsauthpersistent: "...", tenant_id: "..." }`

---

### Custom REST API Explorer (v6.0)

Configurable API explorer for arbitrary REST APIs. User provides: base URL, authentication method (Bearer token, API key header, Basic auth), and optionally an OpenAPI/Swagger spec. Ninken renders a browseable UI with request builder, response viewer, and history.

---

### New Credential Types Phase 2

Further credential strategy enhancements beyond what is already implemented:
- **Cookie size optimization** -- investigate alternatives to server-side session store for very large credentials
- **Additional credential kinds** -- as new providers are added (AWS IAM, custom OAuth), new strategies extend the pattern

---

## Pending -- Low Priority / Future

### Multi-Platform Profiles

Profiles evolve from single-token to multi-token identity containers.

**Mental model:**
- **Profile** = "who am I" -- a user identity with linked tokens per platform
- **App Switcher** = "what am I using" -- platform/service navigation

Architecture:
- A profile holds multiple tokens: `{ profileId, name, tokens: { google: TokenData, github: TokenData, ... } }`
- If tokens belong to different users, user creates separate profiles
- Profile switcher stays in header, app switcher is a separate control

```typescript
type Profile = {
  id: string
  name: string
  avatarUrl?: string
  platforms: {
    google?: GoogleToken
    github?: GitHubToken
    microsoft?: MicrosoftToken
    // future: aws, slack...
  }
}
```

---

### Drive Enhancements

- **Shared Drives support**: "My Drive" vs "Shared Drives" toggle. Use `drive.drives.list()` to enumerate shared drives
- **List view improvements**: Ensure parity with grid view for all actions (context menu, drag-drop, etc.)

---

### Buckets Auto-Discovery

Replace manual Project ID input with auto-discovery using the GCP Resource Manager API (`cloudresourcemanager.projects.list`). Show a dropdown/searchable select of projects the user has access to. Requires adding `cloud-platform.read-only` scope.

---

### Multi-Platform App Switcher

Google-style 9-dot waffle menu in the header for switching between connected platforms without leaving the UI. Grid of platform icons, each showing available services. Clicking switches context (route + sidebar) without page reload.

---

### Attack Path Graph

D3.js-based interactive graph visualization: nodes (users, groups, service accounts, apps), edges (membership, ownership, delegation, roles). Cross-service identity mapping.

---

### Offline Database & Snapshot

SQLite snapshot of audit data for offline analysis and sharing. Export plugins: Excel, CSV, JSON, BloodHound-compatible formats.

---

## Known Bugs

| Bug | Severity | Status |
|-----|----------|--------|
| Slack d_cookie import requires manual bootstrap -- landing page should auto-call `/api/slack/bootstrap` | Medium | Open |
| "Token invalid" on GitHub pages sidebar -- PATs are opaque, not JWTs; should show "PAT (no expiry)" | Medium | Open |
| Flash error on GitHub token load -- brief error before page renders during capability probing | Low | Open |

---

## Implemented

### v1.0 -- Google Workspace

- **Gmail**: Inbox, compose, thread view, attachments, labels with unread counts, search with Gmail query syntax, drafts, mark read/unread, star/unstar, trash/restore
- **Drive**: File browser (grid/list), upload, download, share, preview, search with content search, breadcrumb navigation, context menu, create folder, rename, move, copy, trash
- **Calendar**: Week view, event details, navigation
- **Chat**: Spaces (DMs, rooms, groups), messages, members, threads. 3-column resizable layout
- **Directory**: Users, groups with member expansion
- **GCS Buckets**: Project selector, object browser, preview, download
- **Google Audit** (15 modules):
  - Users, Groups, Admin Roles, OAuth Apps, Domain-Wide Delegation
  - Device Inventory, OU Policy Mapping, Marketplace Apps, Context-Aware Access Policies
  - Admin Reports API (login/admin/OAuth/drive/mobile events)
  - Alert Center (phishing, suspicious login, government-backed attacks)
  - Drive Activity v2 (file access/modify/share tracking)
  - Groups Settings (risk scoring, external member detection)
  - Contacts/People API (directory enumeration, 3 data sources)
  - Audit Query (cross-service keyword search with 35 pre-built red team queries)
- Dashboard, global token refresher (45min auto-refresh), alert system, resizable panels

### v2.0 -- Microsoft 365

- **Outlook**: 3-panel email browser, folders, attachments, search, send
- **OneDrive**: File browser with breadcrumbs, download, search
- **Teams**: 3-column layout (teams, channels, messages)
- **Entra ID**: Tabbed Users/Groups/Roles with member expansion
- **M365 Audit** (12 modules):
  - Users, Groups, Roles, Apps
  - Sign-in Logs, Risky Users (with risk detections timeline)
  - Conditional Access Policies (human-readable conditions, gap analysis)
  - Authentication Methods (per-user MFA enumeration)
  - Cross-Tenant Access (default + partner policies)
  - FOCI Client ID Pivoting (15 client IDs, scope discovery matrix)
  - Resource Pivot Probing (ARM, Key Vault, Storage, DevOps)
  - Audit Query
- FOCI public client token support (no client_secret required)
- Azure CLI/PowerShell cache import (multi-account extraction)
- Service Principal auth (client_credentials grant)

### v3.0 -- GitHub + GitLab

- **GitHub**: Repos, Orgs (members, hooks, installations, teams), Actions (runners, runs, workflows), Gists, search
- **GitHub Audit** (10 modules): Members, Repo Access, Branch Protections, Webhooks, Deploy Keys, Apps, Actions Security, Secrets, Dependabot, Code Scanning
- **GitLab**: Projects (with repo tree drill-down + file viewer), Groups, Pipelines, Snippets
- **GitLab Audit**: Members, Project Access, Deploy Tokens, Runners, Variables, Webhooks
- Credential auto-detection (paste anything, Ninken detects type)
- Audit Query -- cross-service keyword search with pre-built query library

### v4.0 -- Slack

- Channels (with message threads), Files, Users, Dashboard
- Browser session token support (xoxc- + d cookie with bootstrap endpoint)
- Collection Mode: cross-service artifact collection (9 services), download queue (1-at-a-time OPSEC queue, 2s delay, 3 retries), JSZip export
- Cross-service search and data export (JSON/CSV)

### v4.3 -- UX & Tools

- Branded loading screen (Ninken logo + spinner)
- Page cache (`usePageCache` hook with stale-while-revalidate)
- Tools mode + Secret Search (24 regex patterns, SSE streaming, custom patterns)
- AI Partner enhancements: offline/online search, app filter, 7 new provider tools, collection cache search

### v4.4 -- OPSEC Module

- Unified OPSEC page (replaced Stealth)
- Offensive tab: Stealth Calculator + 56 operation scenarios with detection vectors
- Defensive tab: 44 controls across 5 providers with status flags + Attack Surface Gaps

### Platform Infrastructure (cross-cutting)

- **Provider abstraction**: ServiceProvider interface + registry (`src/lib/providers/`)
- **Encrypted IndexedDB token storage** (AES-GCM) (`src/lib/token-store.ts`)
- **CredentialStrategy pattern**: OAuth, FOCI, service-account, service-principal, access-token (`src/lib/providers/strategies/`)
- **Global token refresher**: 45min auto-refresh across all providers (`src/lib/token-refresher.ts`)
- **Token lifecycle panel**: Access token countdown, scope count, manual refresh (`src/components/layout/token-lifecycle.tsx`)
- **Alert system**: IndexedDB store + bell icon badge + full `/alerts` page (`src/lib/alert-store.ts`)
- **Dark mode**: OKLCH color system, dark default
- **Studio module**: Token Analyzer, Services Map, Extraction Database, Converter, Scopes (`src/lib/studio/`, `(studio)` route group)
- **AI Partner**: Claude-powered streaming SSE with tool-use loop, context-aware system prompt (`src/lib/ai/`, `src/components/ai/`)
- **5-mode toggle**: Operate / Audit / Collect / Studio / Tools
- **Resizable panels**: react-resizable-panels across all multi-pane views
- **Collection system**: 9 services with "Send to Collection", IndexedDB storage, download manager, JSZip export
- **Route-aware sidebar**: URL-based provider detection, dynamic nav items
- **Regression & remediation pipeline**: `/fire_regression` + `/fire_remediation` commands
- **Capability probing on import**: Auto-probe credential capabilities after import
- **Raw access token ingestion**: Google `ya29.*`, Microsoft JWT, with expiry countdown
- **Google credential formats**: OAuth token.json, ADC, nested installed/web wrappers, service account key rejection
- **Cookie size solution**: Server-side session store for credentials exceeding 4KB
- **Cross-service data export**: JSON/CSV via ExportButton component
- **Global refresh button**: Cache clear + page reload
