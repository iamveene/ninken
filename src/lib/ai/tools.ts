/**
 * Anthropic tool definitions for the AI Partner.
 * Each tool maps to an internal API route.
 */

import type Anthropic from "@anthropic-ai/sdk"

export type ToolName =
  | "search_gmail"
  | "list_drive_files"
  | "search_drive"
  | "search_outlook"
  | "list_onedrive_files"
  | "list_entra_users"

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

export function getToolsForProvider(
  provider: "google" | "microsoft"
): Anthropic.Tool[] {
  return provider === "google" ? GOOGLE_TOOLS : MICROSOFT_TOOLS
}

/**
 * Map of tool name to the internal API route + method used to execute it.
 */
export type ToolRoute = {
  path: string
  method: "GET" | "POST"
  buildParams: (input: Record<string, unknown>) => URLSearchParams | null
  buildBody?: (input: Record<string, unknown>) => Record<string, unknown>
}

export const TOOL_ROUTES: Record<ToolName, ToolRoute> = {
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
}
