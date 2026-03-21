"use client"

import { useAI } from "./ai-context"
import { useProvider } from "@/components/providers/provider-context"
import type { ProviderId } from "@/lib/providers/types"
import type { AISearchMode } from "@/lib/ai/system-prompt"

type QuickAction = {
  label: string
  prompt: string
}

const GOOGLE_ACTIONS: Record<string, QuickAction[]> = {
  gmail: [
    { label: "Find sensitive emails", prompt: "Search for emails containing passwords, credentials, or API keys" },
    { label: "External sharing", prompt: "Find emails sent to external recipients in the last 30 days" },
    { label: "Admin activity", prompt: "Search for emails from admin or IT accounts" },
  ],
  drive: [
    { label: "Externally shared files", prompt: "Search Drive for files that may be shared externally" },
    { label: "Sensitive documents", prompt: "Search Drive for documents containing 'confidential', 'secret', or 'internal only'" },
    { label: "Recent uploads", prompt: "List the most recently modified files in Drive" },
  ],
  default: [
    { label: "Enumerate inbox", prompt: "Search for the 20 most recent emails and summarize key senders and topics" },
    { label: "Drive overview", prompt: "List the root Drive folder and identify interesting files or folders" },
  ],
}

const MICROSOFT_ACTIONS: Record<string, QuickAction[]> = {
  outlook: [
    { label: "Find sensitive emails", prompt: "Search Outlook for emails containing passwords, credentials, or API keys" },
    { label: "Executive comms", prompt: "Search for emails from C-level executives or VPs in the last 30 days" },
    { label: "Distribution lists", prompt: "Search for emails sent to all-staff or company-wide lists" },
  ],
  onedrive: [
    { label: "Recent files", prompt: "List the most recently modified files in OneDrive" },
    { label: "Sensitive docs", prompt: "Search OneDrive for documents containing 'confidential' or 'restricted'" },
  ],
  directory: [
    { label: "List all users", prompt: "Enumerate all users in the Entra ID directory" },
    { label: "Admin accounts", prompt: "Search for users with 'admin' in their display name or job title" },
    { label: "Disabled accounts", prompt: "List users and identify any disabled accounts" },
  ],
  default: [
    { label: "Enumerate mailbox", prompt: "Search for the 20 most recent Outlook emails and summarize key findings" },
    { label: "Directory overview", prompt: "List Entra ID users and highlight accounts with admin or privileged access" },
  ],
}

const GITHUB_ACTIONS: Record<string, QuickAction[]> = {
  repos: [
    { label: "List all repos", prompt: "List all repositories I have access to and highlight any private or sensitive ones" },
    { label: "Find secrets repos", prompt: "Search for repositories with names containing 'secret', 'credential', 'config', or 'backup'" },
    { label: "Recent activity", prompt: "List repos sorted by most recently pushed and summarize recent activity" },
  ],
  orgs: [
    { label: "List organizations", prompt: "List all organizations I belong to" },
  ],
  default: [
    { label: "Repo overview", prompt: "List my repositories and organizations, highlighting anything security-relevant" },
    { label: "Find secrets", prompt: "Search for repos with names suggesting sensitive content (secrets, keys, configs)" },
    { label: "List gists", prompt: "List my gists and check for any that might contain credentials or sensitive data" },
  ],
}

const GITLAB_ACTIONS: Record<string, QuickAction[]> = {
  projects: [
    { label: "List projects", prompt: "List all GitLab projects I have access to" },
    { label: "Find CI/CD configs", prompt: "Search for projects containing CI/CD pipelines or deploy configurations" },
  ],
  default: [
    { label: "Project overview", prompt: "List my GitLab projects and groups, highlighting interesting access" },
    { label: "Find sensitive projects", prompt: "Search for projects with names suggesting sensitive content (infra, deploy, secrets)" },
  ],
}

const SLACK_ACTIONS: Record<string, QuickAction[]> = {
  channels: [
    { label: "List channels", prompt: "List all channels in the workspace, including private ones I can access" },
    { label: "Find sensitive channels", prompt: "List channels with names suggesting sensitive content (admin, security, infra, credentials)" },
  ],
  users: [
    { label: "List workspace users", prompt: "List all users in the Slack workspace and identify admins" },
  ],
  default: [
    { label: "Workspace overview", prompt: "List channels and users in the workspace, highlighting admins and interesting channels" },
    { label: "Find shared files", prompt: "List files shared in the workspace and identify any sensitive documents" },
    { label: "Enumerate users", prompt: "List all workspace users and identify admin accounts" },
  ],
}

const AWS_ACTIONS: Record<string, QuickAction[]> = {
  s3: [
    { label: "List S3 buckets", prompt: "List all S3 buckets and identify any with public access or interesting names" },
  ],
  iam: [
    { label: "List IAM users", prompt: "List all IAM users and identify those with stale credentials or admin access" },
    { label: "List IAM roles", prompt: "List all IAM roles and highlight cross-account trust or admin policies" },
  ],
  lambda: [
    { label: "List Lambda functions", prompt: "List all Lambda functions and their runtimes" },
  ],
  ec2: [
    { label: "List EC2 instances", prompt: "List all EC2 instances, their state, and any public IPs" },
  ],
  default: [
    { label: "Account overview", prompt: "List S3 buckets, IAM users, and EC2 instances for a quick overview of the AWS account" },
    { label: "IAM enumeration", prompt: "List IAM users and roles to understand the account's permission structure" },
    { label: "Find public resources", prompt: "List S3 buckets and EC2 instances, highlighting any with public access" },
  ],
}

const PROVIDER_ACTIONS: Record<ProviderId, Record<string, QuickAction[]>> = {
  google: GOOGLE_ACTIONS,
  microsoft: MICROSOFT_ACTIONS,
  github: GITHUB_ACTIONS,
  gitlab: GITLAB_ACTIONS,
  slack: SLACK_ACTIONS,
  aws: AWS_ACTIONS,
}

// Page-context-aware extra actions (more specific than the provider defaults)
const PAGE_CONTEXT_ACTIONS: Record<string, QuickAction[]> = {
  gmail: [
    { label: "Find credentials in transit", prompt: "Search emails for passwords, API keys, tokens, or credentials being shared via email" },
    { label: "Phishing indicators", prompt: "Search for emails with suspicious links, attachments, or spoofed sender domains" },
  ],
  repos: [
    { label: "Find exposed secrets", prompt: "Search for repositories that might contain exposed secrets, .env files, or hardcoded credentials" },
    { label: "CI/CD configs", prompt: "Search for repos with CI/CD pipeline configurations (GitHub Actions, .gitlab-ci.yml)" },
  ],
  drive: [
    { label: "Shared externally", prompt: "Find files shared outside the organization or with 'anyone with the link' access" },
    { label: "Credential files", prompt: "Search for files named credentials, secrets, passwords, .env, or config" },
  ],
  outlook: [
    { label: "Find credentials in transit", prompt: "Search Outlook for emails containing passwords, API keys, or credentials" },
    { label: "Executive impersonation", prompt: "Search for emails with display names matching executives but different sender domains" },
  ],
  channels: [
    { label: "Credential leaks", prompt: "Search Slack channels for messages containing passwords, tokens, or API keys" },
    { label: "Admin-only channels", prompt: "List private channels with names suggesting admin, security, or infrastructure access" },
  ],
  s3: [
    { label: "Public buckets", prompt: "List S3 buckets and identify any with public access or permissive ACLs" },
    { label: "Backup buckets", prompt: "Search for S3 buckets with names suggesting backups, dumps, or archives" },
  ],
  iam: [
    { label: "Privilege escalation", prompt: "List IAM roles and identify any with sts:AssumeRole, iam:*, or admin-level policies" },
    { label: "Stale access keys", prompt: "List IAM users and identify those with access keys not rotated in over 90 days" },
  ],
}

// Offline-mode quick actions
const OFFLINE_ACTIONS: QuickAction[] = [
  { label: "Search all collected", prompt: "Search the entire collection and summarize what data has been collected" },
  { label: "Find sensitive items", prompt: "Search the collection for items with titles containing 'password', 'secret', 'credential', 'key', or 'token'" },
  { label: "Collection stats", prompt: "Show a summary of the collection: how many items by source and type" },
  { label: "Recent downloads", prompt: "Show the most recently collected items" },
]

function getPageKey(currentPage: string, provider: ProviderId): string {
  const path = currentPage.toLowerCase()

  switch (provider) {
    case "google":
      if (path.includes("gmail") || path.includes("mail")) return "gmail"
      if (path.includes("drive")) return "drive"
      return "default"
    case "microsoft":
      if (path.includes("outlook") || path.includes("mail")) return "outlook"
      if (path.includes("onedrive") || path.includes("drive")) return "onedrive"
      if (path.includes("directory") || path.includes("entra") || path.includes("users")) return "directory"
      return "default"
    case "github":
      if (path.includes("repos")) return "repos"
      if (path.includes("orgs")) return "orgs"
      return "default"
    case "gitlab":
      if (path.includes("project")) return "projects"
      return "default"
    case "slack":
      if (path.includes("channel")) return "channels"
      if (path.includes("user")) return "users"
      return "default"
    case "aws":
      if (path.includes("s3")) return "s3"
      if (path.includes("iam")) return "iam"
      if (path.includes("lambda")) return "lambda"
      if (path.includes("ec2")) return "ec2"
      return "default"
    default:
      return "default"
  }
}

export function QuickActions({ mode = "online" }: { mode?: AISearchMode }) {
  const { openChat, setPendingPrompt, currentPage } = useAI()
  const { provider } = useProvider()

  // In offline mode, show offline-specific quick actions
  if (mode === "offline") {
    const handleAction = (prompt: string) => {
      setPendingPrompt(prompt)
      openChat()
    }

    return (
      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        {OFFLINE_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.prompt)}
            className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {action.label}
          </button>
        ))}
      </div>
    )
  }

  const actionsMap = PROVIDER_ACTIONS[provider] ?? {}
  const pageKey = getPageKey(currentPage, provider)
  const providerActions = actionsMap[pageKey] || actionsMap.default || []

  // Add page-context-aware actions if the page matches a known context
  const contextActions = PAGE_CONTEXT_ACTIONS[pageKey] || []

  // Merge: page-context actions first (they are more specific), then provider defaults
  // Deduplicate by label
  const seenLabels = new Set<string>()
  const actions: QuickAction[] = []
  for (const action of [...contextActions, ...providerActions]) {
    if (!seenLabels.has(action.label)) {
      seenLabels.add(action.label)
      actions.push(action)
    }
  }

  const handleAction = (prompt: string) => {
    setPendingPrompt(prompt)
    openChat()
  }

  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => handleAction(action.prompt)}
          className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
