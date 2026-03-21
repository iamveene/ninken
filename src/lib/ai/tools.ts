/**
 * Anthropic tool definitions for the AI Partner.
 * Each tool maps to an internal API route.
 */

import type Anthropic from "@anthropic-ai/sdk"
import type { ProviderId } from "@/lib/providers/types"
import type { AISearchMode } from "@/lib/ai/system-prompt"

export type ToolName =
  // Google
  | "search_gmail"
  | "list_drive_files"
  | "search_drive"
  // Microsoft
  | "search_outlook"
  | "list_onedrive_files"
  | "list_entra_users"
  // GitHub
  | "list_github_repos"
  | "list_github_orgs"
  | "list_github_gists"
  | "search_github_repos"
  // GitLab
  | "list_gitlab_projects"
  | "list_gitlab_groups"
  // Slack
  | "list_slack_channels"
  | "list_slack_users"
  | "list_slack_files"
  // AWS
  | "list_aws_s3_buckets"
  | "list_aws_iam_users"
  | "list_aws_iam_roles"
  | "list_aws_lambda_functions"
  | "list_aws_ec2_instances"
  // Offline / Collection
  | "search_collection"

// ---------------------------------------------------------------------------
// Google tools
// ---------------------------------------------------------------------------

export const GOOGLE_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_gmail",
    description:
      "Search Gmail messages using a Gmail search query (same syntax as the Gmail search bar). Returns message metadata including subject, sender, date, and snippet.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Gmail search query. Examples: 'from:admin@company.com', 'subject:password reset', 'has:attachment filename:pdf', 'newer_than:7d'",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (1-50, default 20).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_drive_files",
    description:
      "List files in Google Drive, optionally filtered by folder. Returns file metadata including name, type, owner, sharing status, and modification time.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          description: "Folder ID to list files from. Omit for root folder.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "search_drive",
    description:
      "Search Google Drive for files by name or content. Returns matching files with metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        term: {
          type: "string",
          description: "Search term to look for in file names and content.",
        },
        type: {
          type: "string",
          enum: [
            "document",
            "spreadsheet",
            "presentation",
            "pdf",
            "image",
            "folder",
            "video",
          ],
          description: "Optional file type filter.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 20).",
        },
      },
      required: ["term"],
    },
  },
]

// ---------------------------------------------------------------------------
// Microsoft tools
// ---------------------------------------------------------------------------

export const MICROSOFT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_outlook",
    description:
      "Search Outlook mail messages using KQL (Keyword Query Language). Returns message metadata including subject, sender, date, and preview.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "KQL search query for Outlook. Examples: 'from:admin@company.com', 'subject:credentials', 'hasAttachment:true'",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-50, default 25).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_onedrive_files",
    description:
      "List files in the user's OneDrive, optionally filtered by folder. Returns file metadata including name, size, dates, and web URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          description:
            "Folder item ID to list files from. Omit for root folder.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-200, default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_entra_users",
    description:
      "List or search users in the Entra ID (Azure AD) directory. Returns user metadata including display name, email, job title, department, and account status.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description:
            'KQL search filter for users. Example: \'"displayName:John"\'',
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-999, default 50).",
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// GitHub tools
// ---------------------------------------------------------------------------

export const GITHUB_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_github_repos",
    description:
      "List repositories accessible to the authenticated GitHub user. Returns repo metadata including name, visibility, language, default branch, and permissions.",
    input_schema: {
      type: "object" as const,
      properties: {
        sort: {
          type: "string",
          enum: ["created", "updated", "pushed", "full_name"],
          description: "Sort order for repos (default: updated).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 30).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_github_orgs",
    description:
      "List organizations the authenticated GitHub user belongs to. Returns org metadata including login, description, and URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 30).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_github_gists",
    description:
      "List gists created by the authenticated GitHub user. Returns gist metadata including description, files, and visibility. Useful for finding secrets or credentials accidentally pasted.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 30).",
        },
      },
      required: [],
    },
  },
  {
    name: "search_github_repos",
    description:
      "Search GitHub repositories by name across the user's accessible orgs and repos. Useful for finding repos containing specific keywords (e.g. 'secrets', 'credentials', 'backup').",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Matches against repo names. Example: 'infra', 'deploy', 'secret'",
        },
        org: {
          type: "string",
          description:
            "Optional org login to filter repos for a specific organization.",
        },
      },
      required: ["query"],
    },
  },
]

// ---------------------------------------------------------------------------
// GitLab tools
// ---------------------------------------------------------------------------

export const GITLAB_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_gitlab_projects",
    description:
      "List GitLab projects accessible to the authenticated user. Returns project metadata including name, visibility, default branch, and web URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Search term to filter projects by name.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 20).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_gitlab_groups",
    description:
      "List GitLab groups accessible to the authenticated user. Returns group metadata including name, path, visibility, and membership count.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Search term to filter groups by name.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 20).",
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Slack tools
// ---------------------------------------------------------------------------

export const SLACK_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_slack_channels",
    description:
      "List channels in the Slack workspace. Returns channel metadata including name, topic, purpose, member count, and whether the channel is private or public.",
    input_schema: {
      type: "object" as const,
      properties: {
        types: {
          type: "string",
          enum: ["public", "private", "all"],
          description:
            "Filter by channel type (default: all).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-200, default 100).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_slack_users",
    description:
      "List users in the Slack workspace. Returns user metadata including display name, real name, email, title, and admin status. Useful for enumerating the workspace directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-200, default 100).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_slack_files",
    description:
      "List files shared in the Slack workspace. Returns file metadata including name, type, size, who shared it, and when. Useful for finding sensitive documents, credentials, or interesting attachments.",
    input_schema: {
      type: "object" as const,
      properties: {
        types: {
          type: "string",
          description:
            "Comma-separated file types to filter (e.g., 'pdfs,docs,images'). Omit for all types.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 50).",
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// AWS tools
// ---------------------------------------------------------------------------

export const AWS_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_aws_s3_buckets",
    description:
      "List S3 buckets in the AWS account. Returns bucket names and creation dates. Useful for identifying data stores, backups, and potentially public buckets.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_aws_iam_users",
    description:
      "List IAM users in the AWS account. Returns user metadata including username, creation date, last activity, and MFA status. Useful for enumerating accounts and identifying stale credentials.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_aws_iam_roles",
    description:
      "List IAM roles in the AWS account. Returns role metadata including name, ARN, trust policy, and description. Useful for identifying cross-account access and privilege escalation paths.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_aws_lambda_functions",
    description:
      "List Lambda functions in the AWS account. Returns function metadata including name, runtime, memory, timeout, and last modified. Useful for finding serverless code that may contain secrets or interesting logic.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results (1-50, default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_aws_ec2_instances",
    description:
      "List EC2 instances in the AWS account. Returns instance metadata including ID, type, state, public/private IP, security groups, and tags. Useful for mapping the network and finding exposed hosts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Offline / Collection tools (search cached IndexedDB data)
// ---------------------------------------------------------------------------

export const COLLECTION_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_collection",
    description:
      "Search the operator's offline collection of previously downloaded items (emails, files, repos, channels, audit findings, etc.) stored in the local IndexedDB. Use this in offline mode to search cached data without making live API calls. Returns matching collection items with metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query to match against item titles, subtitles, and metadata. Case-insensitive substring match.",
        },
        source: {
          type: "string",
          enum: [
            "gmail",
            "drive",
            "gcs",
            "outlook",
            "onedrive",
            "teams",
            "github",
            "gitlab",
            "audit-query",
          ],
          description: "Optional: filter by collection source.",
        },
        type: {
          type: "string",
          enum: [
            "email",
            "file",
            "object",
            "chat-message",
            "repo",
            "audit-finding",
            "project",
            "group",
            "snippet",
          ],
          description: "Optional: filter by item type.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100, default 25).",
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Provider-to-tools mapping
// ---------------------------------------------------------------------------

export function getToolsForProvider(
  provider: ProviderId,
  mode: AISearchMode = "online"
): Anthropic.Tool[] {
  if (mode === "offline") {
    return COLLECTION_TOOLS
  }

  switch (provider) {
    case "google":
      return GOOGLE_TOOLS
    case "microsoft":
      return MICROSOFT_TOOLS
    case "github":
      return GITHUB_TOOLS
    case "gitlab":
      return GITLAB_TOOLS
    case "slack":
      return SLACK_TOOLS
    case "aws":
      return AWS_TOOLS
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Tool → API route mapping
// ---------------------------------------------------------------------------

export type ToolRoute = {
  path: string
  method: "GET" | "POST"
  buildParams: (input: Record<string, unknown>) => URLSearchParams | null
  buildBody?: (input: Record<string, unknown>) => Record<string, unknown>
}

export const TOOL_ROUTES: Record<ToolName, ToolRoute> = {
  // ---- Google ----
  search_gmail: {
    path: "/api/gmail/search",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      params.set("q", String(input.query ?? ""))
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_drive_files: {
    path: "/api/drive/files",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.folder) params.set("folder", String(input.folder))
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  search_drive: {
    path: "/api/drive/search",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      params.set("term", String(input.term ?? ""))
      if (input.type) params.set("type", String(input.type))
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },

  // ---- Microsoft ----
  search_outlook: {
    path: "/api/microsoft/mail/search",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      params.set("q", String(input.query ?? ""))
      if (input.limit) params.set("top", String(input.limit))
      return params
    },
  },
  list_onedrive_files: {
    path: "/api/microsoft/drive/files",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.folder) params.set("folder", String(input.folder))
      if (input.limit) params.set("top", String(input.limit))
      return params
    },
  },
  list_entra_users: {
    path: "/api/microsoft/directory/users",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.search) params.set("search", String(input.search))
      if (input.limit) params.set("top", String(input.limit))
      return params
    },
  },

  // ---- GitHub ----
  list_github_repos: {
    path: "/api/github/repos",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.sort) params.set("sort", String(input.sort))
      if (input.limit) params.set("per_page", String(input.limit))
      return params
    },
  },
  list_github_orgs: {
    path: "/api/github/orgs",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("per_page", String(input.limit))
      return params
    },
  },
  list_github_gists: {
    path: "/api/github/gists",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("per_page", String(input.limit))
      return params
    },
  },
  search_github_repos: {
    path: "/api/github/repos",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.query) params.set("q", String(input.query))
      if (input.org) params.set("org", String(input.org))
      return params
    },
  },

  // ---- GitLab ----
  list_gitlab_projects: {
    path: "/api/gitlab/projects",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.search) params.set("search", String(input.search))
      if (input.limit) params.set("per_page", String(input.limit))
      return params
    },
  },
  list_gitlab_groups: {
    path: "/api/gitlab/groups",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.search) params.set("search", String(input.search))
      if (input.limit) params.set("per_page", String(input.limit))
      return params
    },
  },

  // ---- Slack ----
  list_slack_channels: {
    path: "/api/slack/channels",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.types) params.set("types", String(input.types))
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_slack_users: {
    path: "/api/slack/users",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_slack_files: {
    path: "/api/slack/files",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.types) params.set("types", String(input.types))
      if (input.limit) params.set("count", String(input.limit))
      return params
    },
  },

  // ---- AWS ----
  list_aws_s3_buckets: {
    path: "/api/aws/s3/buckets",
    method: "GET",
    buildParams: () => null,
  },
  list_aws_iam_users: {
    path: "/api/aws/iam/users",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_aws_iam_roles: {
    path: "/api/aws/iam/roles",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_aws_lambda_functions: {
    path: "/api/aws/lambda/functions",
    method: "GET",
    buildParams: (input) => {
      const params = new URLSearchParams()
      if (input.limit) params.set("limit", String(input.limit))
      return params
    },
  },
  list_aws_ec2_instances: {
    path: "/api/aws/ec2/instances",
    method: "GET",
    buildParams: () => null,
  },

  // ---- Offline / Collection ----
  search_collection: {
    path: "/api/ai/collection-search",
    method: "POST",
    buildParams: () => null,
    buildBody: (input) => ({
      query: input.query,
      source: input.source,
      type: input.type,
      limit: input.limit,
    }),
  },
}
