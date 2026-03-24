import { z } from "zod"

function toText(data) {
  const text = JSON.stringify(data, null, 2)
  return text.length > 50000 ? text.slice(0, 50000) + "\n...[truncated]" : text
}

// ─── Core Tools ───────────────────────────────────────────────────────────────
// Callback set by index.js to update the active cookie after credential injection
let _setCookie = null
export function setCredentialCallback(fn) { _setCookie = fn }

function registerCoreTools(server, ninkenAPI) {
  server.tool(
    "get_ninken_status",
    "Check if the Ninken web app is running and get version info",
    {},
    async () => {
      const data = await ninkenAPI("/api/health")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_profiles",
    "List all stored credential profiles (provider, email, date added). No secrets exposed.",
    {},
    async () => {
      const data = await ninkenAPI("/api/auth")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "switch_profile",
    "Switch the active credential profile by index. Use list_profiles first to see available indices.",
    {
      index: z.number().int().min(0).describe("Zero-based profile index to activate"),
    },
    async ({ index }) => {
      const data = await ninkenAPI("/api/auth", {
        method: "PATCH",
        body: JSON.stringify({ activeProfile: index }),
      })
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_capabilities",
    "List all available MCP tool categories and their tool names",
    {},
    async () => {
      const capabilities = {
        core: ["get_ninken_status", "list_profiles", "switch_profile", "list_capabilities", "get_token_scopes", "get_audit_overview", "get_ai_config", "get_recent_events", "run_custom_query", "load_credential", "load_credential_file", "vault_extract"],
        google: ["search_gmail", "get_gmail_message", "search_drive", "list_drive_files", "list_calendar_events", "list_gws_users", "list_gws_groups", "list_gws_admin_reports", "list_google_chat_spaces"],
        microsoft: ["list_entra_users", "list_entra_groups", "list_entra_roles", "search_outlook", "list_onedrive_files", "list_ms_sign_ins", "list_ms_conditional_access", "list_ms_service_principals", "foci_pivot", "ms_resource_pivot", "list_ms_teams", "get_teams_messages", "list_sharepoint_sites"],
        github: ["list_github_repos", "list_github_orgs", "get_github_me", "list_github_gists", "list_org_members", "list_repo_secrets", "list_repo_webhooks"],
        gitlab: ["list_gitlab_projects", "list_gitlab_groups", "list_gitlab_snippets"],
        slack: ["list_slack_channels", "list_slack_users", "list_slack_files", "get_slack_messages"],
        aws: ["list_aws_iam_users", "list_aws_s3_buckets", "get_aws_identity", "list_aws_iam_roles", "list_aws_secrets", "assume_aws_role", "get_aws_secret_value", "list_s3_objects", "get_s3_bucket_policy", "list_ec2_instances", "list_security_groups"],
        gcp: ["list_gcp_buckets", "audit_gcp_firewall", "audit_gcp_api_keys"],
      }
      return { content: [{ type: "text", text: toText(capabilities) }] }
    }
  )

  server.tool(
    "get_token_scopes",
    "Get OAuth scopes and permissions for the active credential profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/auth/scopes")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_audit_overview",
    "Get audit overview for the active provider (scope access, service availability)",
    {
      provider: z.enum(["google", "microsoft", "gcp"]).describe("Provider to audit"),
    },
    async ({ provider }) => {
      const path = provider === "gcp" ? "/api/gcp-key/audit/buckets" : provider === "google" ? "/api/audit/overview" : "/api/microsoft/audit/overview"
      const data = await ninkenAPI(path)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_ai_config",
    "Get the current AI provider configuration (provider, model, masked key)",
    {},
    async () => {
      const data = await ninkenAPI("/api/settings")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_recent_events",
    "Get recent Ninken events (audit progress, extractions, vault changes)",
    {
      count: z.number().int().min(1).max(100).default(20).optional().describe("Number of recent events to fetch"),
    },
    async ({ count }) => {
      const params = new URLSearchParams({ count: String(count || 20) })
      const data = await ninkenAPI(`/api/events/recent?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "run_custom_query",
    "Execute a custom GET request against any Ninken API endpoint. Use for advanced queries.",
    {
      path: z.string().describe("API path (e.g., /api/gmail/messages?maxResults=5)"),
    },
    async ({ path }) => {
      const data = await ninkenAPI(path)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "load_credential",
    "Inject a raw credential into Ninken. Supports Google OAuth JSON, GitHub PAT, Microsoft FOCI token, GitLab PAT, Slack tokens, AWS keys, GCP API keys. The credential will appear in the Ninken UI after injection.",
    {
      credential: z.union([z.string(), z.object({}).passthrough()])
        .describe("Raw credential JSON object or JSON string. For GitHub/GitLab PATs: {\"access_token\":\"ghp_...\"}. For Google: the full OAuth token JSON."),
    },
    async ({ credential }) => {
      const cred = typeof credential === "string" ? JSON.parse(credential) : credential
      const data = await ninkenAPI("/api/auth/inject", {
        method: "POST",
        body: JSON.stringify({ credential: cred }),
      })
      if (data._cookie && _setCookie) _setCookie(data._cookie)
      return { content: [{ type: "text", text: toText({ success: data.success, provider: data.provider, email: data.email }) }] }
    }
  )

  server.tool(
    "load_credential_file",
    "Load a credential from a local file path and inject it into Ninken. File should contain JSON (Google OAuth, PAT, FOCI token, etc.)",
    {
      path: z.string().describe("Absolute path to the credential JSON file (e.g., /path/to/secrets/google/token.json)"),
    },
    async ({ path }) => {
      const fs = await import("fs")
      const content = fs.readFileSync(path, "utf-8")
      const cred = JSON.parse(content)
      const data = await ninkenAPI("/api/auth/inject", {
        method: "POST",
        body: JSON.stringify({ credential: cred }),
      })
      if (data._cookie && _setCookie) _setCookie(data._cookie)
      return { content: [{ type: "text", text: toText({ success: data.success, provider: data.provider, email: data.email }) }] }
    }
  )

  // ── Tier 3: Vault ──

  server.tool(
    "vault_extract",
    "AI-powered secret extraction from raw text — finds API keys, tokens, passwords, connection strings using pattern matching and AI analysis",
    {
      rawText: z.string().describe("Raw text to scan for secrets"),
      patternName: z.string().optional().describe("Specific pattern to search for (e.g., 'aws-key', 'jwt')"),
      category: z.string().optional().describe("Category filter (e.g., 'cloud', 'database', 'api')"),
    },
    async ({ rawText, patternName, category }) => {
      const body = { rawText }
      if (patternName) body.patternName = patternName
      if (category) body.category = category
      const data = await ninkenAPI("/api/vault/extract", {
        method: "POST",
        body: JSON.stringify(body),
      })
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── Google Workspace Tools ───────────────────────────────────────────────────
function registerGoogleTools(server, ninkenAPI) {
  server.tool(
    "search_gmail",
    "Search Gmail messages for the active Google Workspace profile",
    {
      query: z.string().describe("Gmail search query (e.g., 'from:alice subject:meeting')"),
      limit: z.number().int().min(1).max(50).default(20).optional().describe("Max results"),
    },
    async ({ query, limit }) => {
      const params = new URLSearchParams({ q: query, maxResults: String(limit || 20) })
      const data = await ninkenAPI(`/api/gmail/search?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_gmail_message",
    "Get a single Gmail message by ID, including full body and headers",
    {
      id: z.string().describe("Gmail message ID (from search_gmail results)"),
    },
    async ({ id }) => {
      const data = await ninkenAPI(`/api/gmail/messages/${encodeURIComponent(id)}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "search_drive",
    "Search Google Drive files for the active Google Workspace profile",
    {
      query: z.string().describe("Drive search query (e.g., 'name contains budget')"),
      limit: z.number().int().min(1).max(50).default(20).optional().describe("Max results"),
    },
    async ({ query, limit }) => {
      const params = new URLSearchParams({ q: query, pageSize: String(limit || 20) })
      const data = await ninkenAPI(`/api/drive/search?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_drive_files",
    "List files in a Google Drive folder",
    {
      folderId: z.string().default("root").optional().describe("Folder ID (default: root)"),
      limit: z.number().int().min(1).max(100).default(50).optional().describe("Max results"),
    },
    async ({ folderId, limit }) => {
      const params = new URLSearchParams({ parent: folderId || "root", pageSize: String(limit || 50) })
      const data = await ninkenAPI(`/api/drive/files?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_calendar_events",
    "List Google Calendar events for the active profile",
    {
      calendarId: z.string().default("primary").optional().describe("Calendar ID (default: primary)"),
      timeMin: z.string().optional().describe("Start time filter (ISO 8601, e.g., 2025-01-01T00:00:00Z)"),
      timeMax: z.string().optional().describe("End time filter (ISO 8601)"),
      maxResults: z.number().int().min(1).max(250).default(50).optional().describe("Max events to return"),
    },
    async ({ calendarId, timeMin, timeMax, maxResults }) => {
      const params = new URLSearchParams()
      if (calendarId) params.set("calendarId", calendarId)
      if (timeMin) params.set("timeMin", timeMin)
      if (timeMax) params.set("timeMax", timeMax)
      params.set("maxResults", String(maxResults || 50))
      const data = await ninkenAPI(`/api/calendar/events?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_gws_users",
    "List Google Workspace directory users (requires admin scope)",
    {
      query: z.string().optional().describe("Search query to filter users"),
    },
    async ({ query }) => {
      const params = query ? new URLSearchParams({ query }) : ""
      const data = await ninkenAPI(`/api/audit/users${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_gws_groups",
    "List Google Workspace groups (requires admin scope)",
    {},
    async () => {
      const data = await ninkenAPI("/api/audit/groups")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_gws_admin_reports",
    "List Google Workspace admin audit reports (login, admin, token, drive, mobile events)",
    {
      application: z.enum(["login", "admin", "token", "drive", "mobile"]).default("login").optional().describe("Report type"),
      userKey: z.string().optional().describe("Filter by user email or 'all'"),
    },
    async ({ application, userKey }) => {
      const params = new URLSearchParams({ application: application || "login" })
      if (userKey) params.set("userKey", userKey)
      const data = await ninkenAPI(`/api/audit/admin-reports?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 4: Data access ──

  server.tool(
    "list_google_chat_spaces",
    "List Google Chat spaces (rooms, DMs, group conversations) accessible to the authenticated user",
    {
      pageSize: z.number().int().min(1).max(1000).optional().describe("Max results per page"),
    },
    async ({ pageSize }) => {
      const params = pageSize ? new URLSearchParams({ pageSize: String(pageSize) }) : ""
      const data = await ninkenAPI(`/api/chat/spaces${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── Microsoft / Entra ID Tools ───────────────────────────────────────────────
function registerMicrosoftTools(server, ninkenAPI) {
  server.tool(
    "list_entra_users",
    "List Microsoft Entra ID (Azure AD) users",
    {
      search: z.string().optional().describe("Search by name or UPN"),
    },
    async ({ search }) => {
      const params = search ? new URLSearchParams({ search }) : ""
      const data = await ninkenAPI(`/api/microsoft/directory/users${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_entra_groups",
    "List Microsoft Entra ID groups",
    {
      top: z.number().int().min(1).max(999).optional().describe("Max results to return"),
    },
    async ({ top }) => {
      const params = top ? new URLSearchParams({ $top: String(top) }) : ""
      const data = await ninkenAPI(`/api/microsoft/directory/groups${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_entra_roles",
    "List Microsoft Entra ID directory roles and their assignments",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/directory/roles")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "search_outlook",
    "Search Outlook mailbox for the active Microsoft profile",
    {
      query: z.string().describe("Search query (KQL syntax, e.g., 'from:alice subject:budget')"),
      top: z.number().int().min(1).max(50).optional().describe("Max results"),
    },
    async ({ query, top }) => {
      const params = new URLSearchParams({ q: query })
      if (top) params.set("top", String(top))
      const data = await ninkenAPI(`/api/microsoft/mail/search?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_onedrive_files",
    "List OneDrive files for the active Microsoft profile",
    {
      folder: z.string().optional().describe("Folder path or ID (default: root)"),
    },
    async ({ folder }) => {
      const params = folder ? new URLSearchParams({ folder }) : ""
      const data = await ninkenAPI(`/api/microsoft/drive/files${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_ms_sign_ins",
    "List Microsoft Entra ID sign-in logs. Requires Entra ID P1/P2 license.",
    {
      top: z.number().int().min(1).max(100).optional().describe("Max results"),
    },
    async ({ top }) => {
      const params = top ? new URLSearchParams({ $top: String(top) }) : ""
      const data = await ninkenAPI(`/api/microsoft/audit/sign-ins${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_ms_conditional_access",
    "List Microsoft Entra ID conditional access policies",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/audit/conditional-access")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_ms_service_principals",
    "List Microsoft Entra ID service principals (enterprise apps). Heavy — may take 10-30s on large tenants.",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/audit/service-principals")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 3: Offensive primitives ──

  server.tool(
    "foci_pivot",
    "FOCI token expansion — attempt to exchange the current Microsoft refresh token for access to all Family of Client IDs (Teams, Outlook, OneDrive, etc.). Ninken's signature capability.",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/audit/foci-pivot", { method: "POST" })
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "ms_resource_pivot",
    "Probe Azure resource access (ARM, KeyVault, Storage, DevOps) using the current Microsoft token. Tests token scope expansion across resource boundaries.",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/audit/resource-pivot")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 4: Data access ──

  server.tool(
    "list_ms_teams",
    "List Microsoft Teams the authenticated user has joined",
    {},
    async () => {
      const data = await ninkenAPI("/api/microsoft/teams/joined")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_teams_messages",
    "Read messages from a Microsoft Teams channel",
    {
      teamId: z.string().describe("Team ID (from list_ms_teams)"),
      channelId: z.string().describe("Channel ID (from team channels)"),
      pageToken: z.string().optional().describe("Pagination token for next page"),
    },
    async ({ teamId, channelId, pageToken }) => {
      const params = pageToken ? new URLSearchParams({ pageToken }) : ""
      const data = await ninkenAPI(`/api/microsoft/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_sharepoint_sites",
    "List or search SharePoint sites accessible to the authenticated user",
    {
      search: z.string().optional().describe("Search query to filter sites"),
      top: z.number().int().min(1).max(100).optional().describe("Max results"),
    },
    async ({ search, top }) => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (top) params.set("top", String(top))
      const qs = params.toString()
      const data = await ninkenAPI(`/api/microsoft/sharepoint/sites${qs ? "?" + qs : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── GitHub Tools ─────────────────────────────────────────────────────────────
function registerGitHubTools(server, ninkenAPI) {
  server.tool(
    "list_github_repos",
    "List GitHub repositories for the active GitHub profile",
    {
      sort: z.enum(["updated", "created", "pushed", "full_name"]).default("updated").optional(),
    },
    async ({ sort }) => {
      const params = new URLSearchParams({ sort: sort || "updated" })
      const data = await ninkenAPI(`/api/github/repos?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_github_orgs",
    "List GitHub organizations for the active profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/github/orgs")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_github_me",
    "Get the authenticated GitHub user's profile (login, name, scopes, plan)",
    {},
    async () => {
      const data = await ninkenAPI("/api/github/me")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_github_gists",
    "List GitHub gists for the active profile (may contain secrets)",
    {},
    async () => {
      const data = await ninkenAPI("/api/github/gists")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_org_members",
    "List members of a GitHub organization",
    {
      org: z.string().describe("Organization login name"),
      role: z.enum(["all", "admin", "member"]).default("all").optional().describe("Filter by role"),
    },
    async ({ org, role }) => {
      const params = role ? new URLSearchParams({ role }) : ""
      const data = await ninkenAPI(`/api/github/orgs/${encodeURIComponent(org)}/members${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_repo_secrets",
    "List GitHub Actions secrets for a repository (names only, not values)",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
    },
    async ({ owner, repo }) => {
      const data = await ninkenAPI(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/secrets`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_repo_webhooks",
    "List webhooks configured on a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
    },
    async ({ owner, repo }) => {
      const data = await ninkenAPI(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── GitLab Tools ─────────────────────────────────────────────────────────────
function registerGitLabTools(server, ninkenAPI) {
  server.tool(
    "list_gitlab_projects",
    "List GitLab projects for the active GitLab profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/gitlab/projects")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_gitlab_groups",
    "List GitLab groups for the active GitLab profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/gitlab/groups")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_gitlab_snippets",
    "List GitLab snippets for the active profile (may contain secrets)",
    {},
    async () => {
      const data = await ninkenAPI("/api/gitlab/snippets")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── Slack Tools ──────────────────────────────────────────────────────────────
function registerSlackTools(server, ninkenAPI) {
  server.tool(
    "list_slack_channels",
    "List Slack channels for the active Slack profile",
    {
      view: z.enum(["all", "public", "private", "im", "archived"]).default("all").optional().describe("Channel type filter"),
    },
    async ({ view }) => {
      const params = view ? new URLSearchParams({ view }) : ""
      const data = await ninkenAPI(`/api/slack/channels${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_slack_users",
    "List Slack workspace users for the active profile",
    {
      limit: z.number().int().min(1).max(1000).optional().describe("Max results"),
    },
    async ({ limit }) => {
      const params = limit ? new URLSearchParams({ limit: String(limit) }) : ""
      const data = await ninkenAPI(`/api/slack/users${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_slack_files",
    "List files shared in Slack for the active profile",
    {
      channel: z.string().optional().describe("Filter by channel ID"),
      types: z.string().optional().describe("Comma-separated file types (e.g., 'images,pdfs,snippets')"),
      count: z.number().int().min(1).max(100).optional().describe("Max results"),
    },
    async ({ channel, types, count }) => {
      const params = new URLSearchParams()
      if (channel) params.set("channel", channel)
      if (types) params.set("types", types)
      if (count) params.set("count", String(count))
      const qs = params.toString()
      const data = await ninkenAPI(`/api/slack/files${qs ? "?" + qs : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 4: Data access ──

  server.tool(
    "get_slack_messages",
    "Read messages from a Slack channel (includes threads, reactions, files)",
    {
      channelId: z.string().describe("Slack channel ID (from list_slack_channels)"),
      limit: z.number().int().min(1).max(100).optional().describe("Max messages to return"),
      cursor: z.string().optional().describe("Pagination cursor for next page"),
    },
    async ({ channelId, limit, cursor }) => {
      const params = new URLSearchParams()
      if (limit) params.set("limit", String(limit))
      if (cursor) params.set("cursor", cursor)
      const qs = params.toString()
      const data = await ninkenAPI(`/api/slack/channels/${encodeURIComponent(channelId)}/messages${qs ? "?" + qs : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── AWS Tools ────────────────────────────────────────────────────────────────
function registerAwsTools(server, ninkenAPI) {
  server.tool(
    "list_aws_iam_users",
    "List AWS IAM users for the active AWS profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/aws/iam/users")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_aws_s3_buckets",
    "List S3 buckets for the active AWS profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/aws/s3/buckets")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_aws_identity",
    "Get the AWS caller identity (account ID, ARN, user ID) via STS",
    {},
    async () => {
      const data = await ninkenAPI("/api/aws/me")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_aws_iam_roles",
    "List AWS IAM roles for the active AWS profile",
    {},
    async () => {
      const data = await ninkenAPI("/api/aws/iam/roles")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_aws_secrets",
    "List AWS Secrets Manager secrets for the active profile (names/ARNs only, not values)",
    {
      region: z.string().optional().describe("AWS region override (e.g., us-east-1)"),
    },
    async ({ region }) => {
      const params = region ? new URLSearchParams({ region }) : ""
      const data = await ninkenAPI(`/api/aws/secrets/list${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 3: Offensive primitives ──

  server.tool(
    "assume_aws_role",
    "Assume an AWS IAM role via STS — lateral movement and privilege escalation. Returns temporary credentials.",
    {
      roleArn: z.string().describe("ARN of the role to assume (e.g., arn:aws:iam::123456789012:role/RoleName)"),
      sessionName: z.string().optional().describe("Session name for CloudTrail attribution"),
    },
    async ({ roleArn, sessionName }) => {
      const body = { roleArn }
      if (sessionName) body.sessionName = sessionName
      const data = await ninkenAPI("/api/aws/sts/assume-role", {
        method: "POST",
        body: JSON.stringify(body),
      })
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_aws_secret_value",
    "Retrieve the actual value of an AWS Secrets Manager secret",
    {
      secretId: z.string().describe("Secret name or ARN"),
      region: z.string().optional().describe("AWS region override"),
    },
    async ({ secretId, region }) => {
      const params = new URLSearchParams({ secretId })
      if (region) params.set("region", region)
      const data = await ninkenAPI(`/api/aws/secrets/value?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 4: Data access ──

  server.tool(
    "list_s3_objects",
    "Browse objects in an S3 bucket (supports prefix filtering for folder navigation)",
    {
      bucket: z.string().describe("S3 bucket name"),
      prefix: z.string().optional().describe("Key prefix to filter (e.g., 'logs/' for folder)"),
      region: z.string().optional().describe("AWS region override"),
    },
    async ({ bucket, prefix, region }) => {
      const params = new URLSearchParams({ bucket })
      if (prefix) params.set("prefix", prefix)
      if (region) params.set("region", region)
      const data = await ninkenAPI(`/api/aws/s3/objects?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "get_s3_bucket_policy",
    "Get the bucket policy for an S3 bucket — reveals public access and cross-account permissions",
    {
      bucket: z.string().describe("S3 bucket name"),
      region: z.string().optional().describe("AWS region override"),
    },
    async ({ bucket, region }) => {
      const params = new URLSearchParams({ bucket })
      if (region) params.set("region", region)
      const data = await ninkenAPI(`/api/aws/s3/policy?${params}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_ec2_instances",
    "List EC2 instances — running hosts, IPs, instance types, VPCs",
    {
      region: z.string().optional().describe("AWS region override"),
    },
    async ({ region }) => {
      const params = region ? new URLSearchParams({ region }) : ""
      const data = await ninkenAPI(`/api/aws/ec2/instances${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "list_security_groups",
    "List EC2 security groups — inbound/outbound rules for network exposure analysis",
    {
      region: z.string().optional().describe("AWS region override"),
    },
    async ({ region }) => {
      const params = region ? new URLSearchParams({ region }) : ""
      const data = await ninkenAPI(`/api/aws/ec2/security-groups${params ? "?" + params : ""}`)
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── GCP Tools ────────────────────────────────────────────────────────────────
function registerGcpTools(server, ninkenAPI) {
  server.tool(
    "list_gcp_buckets",
    "List GCP Cloud Storage buckets with public access audit",
    {},
    async () => {
      const data = await ninkenAPI("/api/gcp-key/audit/buckets")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  // ── Tier 4: Audit ──

  server.tool(
    "audit_gcp_firewall",
    "Audit GCP VPC firewall rules — find open-to-world rules (0.0.0.0/0) and overly permissive ingress",
    {},
    async () => {
      const data = await ninkenAPI("/api/gcp-key/audit/firewall")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )

  server.tool(
    "audit_gcp_api_keys",
    "Audit GCP API keys — find unrestricted keys with no application or API restrictions",
    {},
    async () => {
      const data = await ninkenAPI("/api/gcp-key/audit/api-keys")
      return { content: [{ type: "text", text: toText(data) }] }
    }
  )
}

// ─── Public entry point ───────────────────────────────────────────────────────
export function registerTools(server, ninkenAPI) {
  registerCoreTools(server, ninkenAPI)
  registerGoogleTools(server, ninkenAPI)
  registerMicrosoftTools(server, ninkenAPI)
  registerGitHubTools(server, ninkenAPI)
  registerGitLabTools(server, ninkenAPI)
  registerSlackTools(server, ninkenAPI)
  registerAwsTools(server, ninkenAPI)
  registerGcpTools(server, ninkenAPI)
}
