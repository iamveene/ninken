/**
 * Microsoft Graph service catalog with scopes, endpoints, and stealth scores.
 * Used by the Studio Service Map and Scope Calculator.
 */

import type { StealthLevel } from "./stealth-scores"

export interface MicrosoftService {
  id: string
  name: string
  description: string
  category: "productivity" | "identity" | "security" | "communication" | "cloud"
  baseUrl: string
  docsUrl: string
  /** Delegated permissions (scopes) */
  scopes: string[]
  endpoints: MicrosoftEndpoint[]
  stealthLevel: StealthLevel
  commonlyMonitored: boolean
}

export interface MicrosoftEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  description: string
  stealthLevel: StealthLevel
  mutating: boolean
  useCase?: string
}

export const MICROSOFT_SERVICES: MicrosoftService[] = [
  {
    id: "mail",
    name: "Outlook Mail",
    description: "Read, send, and manage email via Microsoft Graph.",
    category: "productivity",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview",
    scopes: ["Mail.Read", "Mail.ReadWrite", "Mail.Send"],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/me/messages", description: "List messages", stealthLevel: 1, mutating: false, useCase: "Enumerate emails for intelligence" },
      { method: "GET", path: "/me/messages/{id}", description: "Get message", stealthLevel: 1, mutating: false },
      { method: "POST", path: "/me/sendMail", description: "Send mail", stealthLevel: 4, mutating: true, useCase: "Send phishing from compromised account" },
      { method: "GET", path: "/me/mailFolders", description: "List mail folders", stealthLevel: 1, mutating: false },
      { method: "POST", path: "/me/mailFolders/inbox/messageRules", description: "Create inbox rule", stealthLevel: 5, mutating: true, useCase: "Persistence via inbox rules" },
      { method: "GET", path: "/me/mailFolders/inbox/messageRules", description: "List inbox rules", stealthLevel: 2, mutating: false, useCase: "Check for existing persistence" },
    ],
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Access and manage files stored in OneDrive and SharePoint.",
    category: "productivity",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/onedrive",
    scopes: ["Files.Read", "Files.ReadWrite", "Sites.Read.All"],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/me/drive/root/children", description: "List root files", stealthLevel: 1, mutating: false, useCase: "Browse OneDrive contents" },
      { method: "GET", path: "/me/drive/items/{id}/content", description: "Download file", stealthLevel: 2, mutating: false, useCase: "Exfiltrate files" },
      { method: "GET", path: "/me/drive/search(q='{query}')", description: "Search files", stealthLevel: 2, mutating: false, useCase: "Find sensitive documents" },
      { method: "GET", path: "/me/drive/sharedWithMe", description: "Shared with me", stealthLevel: 1, mutating: false, useCase: "Find shared sensitive files" },
    ],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Access Teams chats, channels, and messages.",
    category: "communication",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview",
    scopes: ["Team.ReadBasic.All", "Channel.ReadBasic.All", "ChannelMessage.Read.All", "Chat.Read"],
    stealthLevel: 2,
    commonlyMonitored: false,
    endpoints: [
      { method: "GET", path: "/me/joinedTeams", description: "List joined teams", stealthLevel: 1, mutating: false, useCase: "Enumerate team membership" },
      { method: "GET", path: "/teams/{id}/channels", description: "List channels", stealthLevel: 1, mutating: false },
      { method: "GET", path: "/teams/{id}/channels/{channelId}/messages", description: "List messages", stealthLevel: 2, mutating: false, useCase: "Read channel messages for intel" },
      { method: "GET", path: "/me/chats", description: "List chats", stealthLevel: 2, mutating: false, useCase: "Access private chats" },
    ],
  },
  {
    id: "directory",
    name: "Azure AD Directory",
    description: "Manage users, groups, and directory objects in Azure AD.",
    category: "identity",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/azure-ad-overview",
    scopes: ["User.Read.All", "Group.Read.All", "Directory.Read.All", "RoleManagement.Read.Directory"],
    stealthLevel: 3,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/users", description: "List users", stealthLevel: 2, mutating: false, useCase: "Enumerate all tenant users" },
      { method: "GET", path: "/users/{id}", description: "Get user", stealthLevel: 2, mutating: false },
      { method: "GET", path: "/groups", description: "List groups", stealthLevel: 2, mutating: false, useCase: "Map security groups" },
      { method: "GET", path: "/groups/{id}/members", description: "List group members", stealthLevel: 2, mutating: false },
      { method: "GET", path: "/directoryRoles", description: "List directory roles", stealthLevel: 3, mutating: false, useCase: "Identify admin role assignments" },
      { method: "GET", path: "/directoryRoles/{id}/members", description: "List role members", stealthLevel: 3, mutating: false, useCase: "Find Global Admins" },
      { method: "GET", path: "/applications", description: "List applications", stealthLevel: 3, mutating: false, useCase: "Enumerate app registrations" },
      { method: "GET", path: "/servicePrincipals", description: "List service principals", stealthLevel: 3, mutating: false, useCase: "Find service principals for lateral movement" },
    ],
  },
  {
    id: "conditional-access",
    name: "Conditional Access",
    description: "Manage Azure AD Conditional Access policies.",
    category: "security",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccesspolicy",
    scopes: ["Policy.Read.All"],
    stealthLevel: 4,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/identity/conditionalAccess/policies", description: "List CA policies", stealthLevel: 3, mutating: false, useCase: "Understand security controls to evade" },
      { method: "GET", path: "/identity/conditionalAccess/namedLocations", description: "List named locations", stealthLevel: 2, mutating: false, useCase: "Identify trusted IP ranges" },
    ],
  },
  {
    id: "intune",
    name: "Microsoft Intune",
    description: "Manage devices and apps via Intune.",
    category: "security",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/intune-graph-overview",
    scopes: ["DeviceManagementManagedDevices.Read.All", "DeviceManagementConfiguration.Read.All"],
    stealthLevel: 3,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/deviceManagement/managedDevices", description: "List managed devices", stealthLevel: 2, mutating: false, useCase: "Enumerate corporate devices" },
      { method: "GET", path: "/deviceManagement/deviceConfigurations", description: "List device configs", stealthLevel: 3, mutating: false, useCase: "Review security configurations" },
    ],
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Access SharePoint sites, lists, and document libraries.",
    category: "productivity",
    baseUrl: "https://graph.microsoft.com/v1.0",
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/sharepoint",
    scopes: ["Sites.Read.All", "Sites.ReadWrite.All"],
    stealthLevel: 2,
    commonlyMonitored: false,
    endpoints: [
      { method: "GET", path: "/sites", description: "Search sites", stealthLevel: 1, mutating: false, useCase: "Discover SharePoint sites" },
      { method: "GET", path: "/sites/{id}/lists", description: "List lists", stealthLevel: 1, mutating: false },
      { method: "GET", path: "/sites/{id}/drive/root/children", description: "Browse document library", stealthLevel: 1, mutating: false, useCase: "Browse shared documents" },
    ],
  },
]

export function getMicrosoftService(id: string): MicrosoftService | undefined {
  return MICROSOFT_SERVICES.find((s) => s.id === id)
}

export function getMicrosoftServicesByCategory(category: MicrosoftService["category"]): MicrosoftService[] {
  return MICROSOFT_SERVICES.filter((s) => s.category === category)
}

export function findMicrosoftServicesByScope(scope: string): MicrosoftService[] {
  return MICROSOFT_SERVICES.filter((s) => s.scopes.some((ss) => ss.toLowerCase() === scope.toLowerCase()))
}
