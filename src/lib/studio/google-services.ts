/**
 * Google API service catalog with scopes, endpoints, and stealth scores.
 * Used by the Studio Service Map and Scope Calculator.
 */

import type { StealthLevel } from "./stealth-scores"

export interface GoogleService {
  id: string
  name: string
  description: string
  category: "workspace" | "cloud" | "identity" | "security" | "other"
  /** Primary API base URL */
  baseUrl: string
  /** Documentation link */
  docsUrl: string
  /** Required OAuth2 scopes */
  scopes: string[]
  /** Key endpoints for red team operations */
  endpoints: GoogleEndpoint[]
  /** Overall stealth rating for using this service */
  stealthLevel: StealthLevel
  /** Whether this service is commonly monitored */
  commonlyMonitored: boolean
}

export interface GoogleEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  description: string
  stealthLevel: StealthLevel
  /** Whether this endpoint modifies state */
  mutating: boolean
  /** Red team use case */
  useCase?: string
}

export const GOOGLE_SERVICES: GoogleService[] = [
  {
    id: "gmail",
    name: "Gmail API",
    description: "Read, send, and manage email messages and threads.",
    category: "workspace",
    baseUrl: "https://gmail.googleapis.com/gmail/v1",
    docsUrl: "https://developers.google.com/gmail/api",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
      "https://mail.google.com/",
    ],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/users/me/messages", description: "List messages", stealthLevel: 1, mutating: false, useCase: "Enumerate emails for credential harvesting" },
      { method: "GET", path: "/users/me/messages/{id}", description: "Get message", stealthLevel: 1, mutating: false, useCase: "Read specific email content" },
      { method: "GET", path: "/users/me/threads", description: "List threads", stealthLevel: 1, mutating: false },
      { method: "POST", path: "/users/me/messages/send", description: "Send message", stealthLevel: 4, mutating: true, useCase: "Phishing from compromised account" },
      { method: "POST", path: "/users/me/messages/{id}/modify", description: "Modify labels", stealthLevel: 3, mutating: true, useCase: "Hide sent phishing emails" },
      { method: "GET", path: "/users/me/settings/forwardingAddresses", description: "List forwarding", stealthLevel: 2, mutating: false, useCase: "Check for persistence via forwarding" },
      { method: "PUT", path: "/users/me/settings/forwardingAddresses", description: "Add forwarding", stealthLevel: 5, mutating: true, useCase: "Establish email forwarding persistence" },
      { method: "GET", path: "/users/me/settings/filters", description: "List filters", stealthLevel: 1, mutating: false, useCase: "Check for existing exfil filters" },
      { method: "POST", path: "/users/me/settings/filters", description: "Create filter", stealthLevel: 4, mutating: true, useCase: "Auto-forward or hide specific emails" },
    ],
  },
  {
    id: "drive",
    name: "Google Drive API",
    description: "Manage files and folders in Google Drive.",
    category: "workspace",
    baseUrl: "https://www.googleapis.com/drive/v3",
    docsUrl: "https://developers.google.com/drive/api",
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/files", description: "List files", stealthLevel: 1, mutating: false, useCase: "Enumerate accessible files" },
      { method: "GET", path: "/files/{id}", description: "Get file metadata", stealthLevel: 1, mutating: false },
      { method: "GET", path: "/files/{id}?alt=media", description: "Download file", stealthLevel: 2, mutating: false, useCase: "Exfiltrate file contents" },
      { method: "GET", path: "/files/{id}/permissions", description: "List permissions", stealthLevel: 1, mutating: false, useCase: "Map sharing and access" },
      { method: "POST", path: "/files/{id}/permissions", description: "Share file", stealthLevel: 4, mutating: true, useCase: "Share sensitive files externally" },
      { method: "GET", path: "/drives", description: "List shared drives", stealthLevel: 1, mutating: false, useCase: "Discover shared drives" },
      { method: "POST", path: "/files/{id}/copy", description: "Copy file", stealthLevel: 3, mutating: true, useCase: "Copy files to controlled location" },
    ],
  },
  {
    id: "calendar",
    name: "Google Calendar API",
    description: "Manage calendars and events.",
    category: "workspace",
    baseUrl: "https://www.googleapis.com/calendar/v3",
    docsUrl: "https://developers.google.com/calendar/api",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar",
    ],
    stealthLevel: 1,
    commonlyMonitored: false,
    endpoints: [
      { method: "GET", path: "/users/me/calendarList", description: "List calendars", stealthLevel: 1, mutating: false, useCase: "Discover org calendar structure" },
      { method: "GET", path: "/calendars/{id}/events", description: "List events", stealthLevel: 1, mutating: false, useCase: "Reconnaissance -- meeting schedules, participants" },
      { method: "POST", path: "/calendars/{id}/events", description: "Create event", stealthLevel: 3, mutating: true, useCase: "Social engineering via calendar invites" },
    ],
  },
  {
    id: "admin-directory",
    name: "Admin SDK Directory API",
    description: "Manage users, groups, and organizational units in Google Workspace.",
    category: "identity",
    baseUrl: "https://admin.googleapis.com/admin/directory/v1",
    docsUrl: "https://developers.google.com/admin-sdk/directory",
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
      "https://www.googleapis.com/auth/admin.directory.group.readonly",
      "https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly",
    ],
    stealthLevel: 3,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/users", description: "List users", stealthLevel: 2, mutating: false, useCase: "Enumerate all org users" },
      { method: "GET", path: "/users/{userKey}", description: "Get user", stealthLevel: 2, mutating: false, useCase: "Get user details, admin status" },
      { method: "GET", path: "/groups", description: "List groups", stealthLevel: 2, mutating: false, useCase: "Enumerate security groups" },
      { method: "GET", path: "/groups/{groupKey}/members", description: "List group members", stealthLevel: 2, mutating: false, useCase: "Map group membership" },
      { method: "GET", path: "/customer/my_customer/roles", description: "List admin roles", stealthLevel: 3, mutating: false, useCase: "Identify admin role assignments" },
      { method: "GET", path: "/customer/my_customer/roleassignments", description: "List role assignments", stealthLevel: 3, mutating: false, useCase: "Find all admin users" },
    ],
  },
  {
    id: "cloud-storage",
    name: "Cloud Storage JSON API",
    description: "Manage Google Cloud Storage buckets and objects.",
    category: "cloud",
    baseUrl: "https://storage.googleapis.com/storage/v1",
    docsUrl: "https://cloud.google.com/storage/docs/json_api",
    scopes: [
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/devstorage.read_write",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/b?project={project}", description: "List buckets", stealthLevel: 1, mutating: false, useCase: "Enumerate GCS buckets" },
      { method: "GET", path: "/b/{bucket}/o", description: "List objects", stealthLevel: 1, mutating: false, useCase: "Browse bucket contents" },
      { method: "GET", path: "/b/{bucket}/o/{object}?alt=media", description: "Download object", stealthLevel: 2, mutating: false, useCase: "Exfiltrate stored data" },
      { method: "GET", path: "/b/{bucket}/iam", description: "Get bucket IAM", stealthLevel: 2, mutating: false, useCase: "Check bucket permissions" },
    ],
  },
  {
    id: "cloud-resource-manager",
    name: "Cloud Resource Manager API",
    description: "Manage GCP projects and organizations.",
    category: "cloud",
    baseUrl: "https://cloudresourcemanager.googleapis.com/v1",
    docsUrl: "https://cloud.google.com/resource-manager/docs",
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform.read-only",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    stealthLevel: 2,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/projects", description: "List projects", stealthLevel: 1, mutating: false, useCase: "Enumerate GCP projects" },
      { method: "POST", path: "/projects/{project}:getIamPolicy", description: "Get IAM policy", stealthLevel: 2, mutating: false, useCase: "Enumerate project-level permissions" },
    ],
  },
  {
    id: "people",
    name: "People API",
    description: "Access Google Contacts and profile information.",
    category: "workspace",
    baseUrl: "https://people.googleapis.com/v1",
    docsUrl: "https://developers.google.com/people",
    scopes: [
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/directory.readonly",
    ],
    stealthLevel: 1,
    commonlyMonitored: false,
    endpoints: [
      { method: "GET", path: "/people/me", description: "Get current user profile", stealthLevel: 1, mutating: false },
      { method: "GET", path: "/people/me/connections", description: "List contacts", stealthLevel: 1, mutating: false, useCase: "Harvest contact information" },
      { method: "GET", path: "/people:searchDirectoryPeople", description: "Search directory", stealthLevel: 1, mutating: false, useCase: "Enumerate org directory" },
    ],
  },
  {
    id: "iam",
    name: "IAM API",
    description: "Manage service accounts and IAM policies.",
    category: "security",
    baseUrl: "https://iam.googleapis.com/v1",
    docsUrl: "https://cloud.google.com/iam/docs",
    scopes: [
      "https://www.googleapis.com/auth/iam",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    stealthLevel: 4,
    commonlyMonitored: true,
    endpoints: [
      { method: "GET", path: "/projects/{project}/serviceAccounts", description: "List service accounts", stealthLevel: 2, mutating: false, useCase: "Find service accounts to impersonate" },
      { method: "POST", path: "/projects/{project}/serviceAccounts/{sa}/keys", description: "Create SA key", stealthLevel: 5, mutating: true, useCase: "Generate persistent credential" },
      { method: "POST", path: "/projects/{project}/serviceAccounts/{sa}:generateAccessToken", description: "Impersonate SA", stealthLevel: 4, mutating: false, useCase: "Lateral movement via SA impersonation" },
    ],
  },
]

/**
 * Get a Google service by ID.
 */
export function getGoogleService(id: string): GoogleService | undefined {
  return GOOGLE_SERVICES.find((s) => s.id === id)
}

/**
 * Get all Google services in a specific category.
 */
export function getGoogleServicesByCategory(category: GoogleService["category"]): GoogleService[] {
  return GOOGLE_SERVICES.filter((s) => s.category === category)
}

/**
 * Find Google services that require a specific scope.
 */
export function findServicesByScope(scope: string): GoogleService[] {
  return GOOGLE_SERVICES.filter((s) => s.scopes.includes(scope))
}
