"use client"

import { useAI } from "./ai-context"
import { useProvider } from "@/components/providers/provider-context"

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

function getPageKey(currentPage: string): string {
  const path = currentPage.toLowerCase()
  if (path.includes("gmail") || path.includes("mail")) return "outlook"
  if (path.includes("drive") || path.includes("onedrive")) return "onedrive"
  if (path.includes("directory") || path.includes("entra") || path.includes("users")) return "directory"
  if (path.includes("outlook")) return "outlook"
  return "default"
}

function getGooglePageKey(currentPage: string): string {
  const path = currentPage.toLowerCase()
  if (path.includes("gmail") || path.includes("mail")) return "gmail"
  if (path.includes("drive")) return "drive"
  return "default"
}

export function QuickActions() {
  const { openChat, setPendingPrompt, currentPage } = useAI()
  const { provider } = useProvider()

  const actionsMap = provider === "google" ? GOOGLE_ACTIONS : MICROSOFT_ACTIONS
  const pageKey =
    provider === "google"
      ? getGooglePageKey(currentPage)
      : getPageKey(currentPage)
  const actions = actionsMap[pageKey] || actionsMap.default || []

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
