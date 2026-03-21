"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { KqlQueryPack } from "./kql-query-pack"
import { DetectionRules } from "./detection-rules"

// ---------------------------------------------------------------------------
// Markdown component overrides for dark-mode paper rendering
// ---------------------------------------------------------------------------

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 text-sm font-bold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-xs leading-relaxed text-muted-foreground mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc pl-4 space-y-0.5 text-xs text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal pl-4 space-y-0.5 text-xs text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-xs text-muted-foreground">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em>{children}</em>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return <code className="text-[11px]">{children}</code>
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-foreground">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-border/30 bg-black/30 p-3 text-[11px] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border-b border-border/50 text-muted-foreground">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-3 border-border/50" />
  ),
}

// ---------------------------------------------------------------------------
// Paper section data
// ---------------------------------------------------------------------------

interface PaperSection {
  id: string
  number: number
  title: string
  content: string
  /** If true, render a special component instead of markdown */
  specialComponent?: "kql" | "detection"
}

const PAPER_SECTIONS: PaperSection[] = [
  {
    id: "abstract",
    number: 1,
    title: "Abstract",
    content: `Organizations that restrict endpoint access to Microsoft 365 services, permitting only browser-based OWA (Outlook Web App) sessions, often assume this posture prevents token theft and lateral movement. This paper demonstrates that this assumption is false.

We present a complete attack chain starting from a single OWA browser session at ACME Corp: extracting plaintext MSAL tokens from browser localStorage, performing same-client scope expansion to access 50+ effective scopes across 16+ Microsoft services, and pivoting to read mail, enumerate directories, access files, and exfiltrate data — all without triggering standard security alerts.

This is **not** a FOCI (Family of Client IDs) cross-client exchange. The OWA client (9199bf20) is not a FOCI member. Instead, we exploit the fact that Microsoft's SPA (Single Page Application) token architecture grants the OWA client implicit access to a wide range of resource audiences through same-client token exchanges.`,
  },
  {
    id: "introduction",
    number: 2,
    title: "Introduction",
    content: `### The M365 Token Landscape

Microsoft 365 authentication relies on OAuth 2.0 and OpenID Connect flows, implemented through the Microsoft Authentication Library (MSAL). When a user signs into a Microsoft web application, MSAL manages token acquisition, caching, and renewal.

Key concepts:

- **Access Tokens (AT)**: Short-lived (~1 hour), scoped to a specific resource (audience). Each resource requires its own access token.
- **Refresh Tokens (RT)**: Longer-lived, used to obtain new access tokens without user interaction. A single refresh token can be exchanged for access tokens to multiple resources — if the client has permission.
- **MSAL Cache**: The browser-side token cache that stores all tokens in memory and, for persistence, in \`localStorage\`.

### Why Organizations Restrict to OWA

Many organizations, including ACME Corp, operate under the assumption that:

1. Browser-only access prevents token extraction (no desktop apps = no token files)
2. OWA access is limited to email functionality
3. Web sessions cannot be replayed from different machines

This paper demonstrates that all three assumptions are incorrect.

### FOCI vs. Same-Client Expansion

FOCI (Family of Client IDs) allows token exchange **across different client applications** within the same family. This is a well-known technique documented by researchers.

What we demonstrate is different: **same-client scope expansion**, where a single client's refresh token is used to obtain access tokens for resources far beyond the application's apparent purpose. The OWA client (9199bf20) is not a FOCI member, yet it can access Graph API, EWS, Substrate, and numerous other Microsoft services.`,
  },
  {
    id: "attack-surface",
    number: 3,
    title: "Attack Surface",
    content: `### OWA Browser Session as Entry Point

The attack surface begins with any active OWA (Outlook Web App) session at \`outlook.office.com\`. When a user authenticates, MSAL creates a comprehensive token cache in the browser's \`localStorage\`.

### MSAL localStorage Cache Structure

MSAL stores tokens using a predictable key format:

\`\`\`
msal.<client-id>.<cache-key-type>
\`\`\`

The cache contains several key types:

| Key Pattern | Contents |
|---|---|
| \`msal.token.keys.<client-id>\` | Index of all cached token keys |
| \`msal.<home-account-id>-<env>-accesstoken-<client-id>-<tenant>-<scopes>\` | Access token entry |
| \`msal.<home-account-id>-<env>-refreshtoken-<client-id>--\` | Refresh token entry |
| \`msal.<home-account-id>-<env>-idtoken-<client-id>-<tenant>-\` | ID token entry |

### Critical Finding: Plaintext Storage

All tokens are stored in **plaintext JSON** in \`localStorage\`. There is no encryption, no hardware binding, and no integrity protection. Any JavaScript execution context with access to the page's origin can read the entire token cache.

For an active OWA session at ACME Corp, we observed:

- **17 access tokens** across 16 distinct resource audiences
- **1 refresh token** (reusable across all resource audiences)
- **1 ID token** with user claims
- All stored under the client ID \`9199bf20-2e73-4588-8bbe-e89007112301\``,
  },
  {
    id: "extraction",
    number: 4,
    title: "Extraction Technique",
    content: `### Prerequisites

- Active OWA session at \`outlook.office.com\` (user is logged in)
- Ability to execute JavaScript in the browser context (DevTools, browser extension, XSS, or compromised endpoint)

### Step-by-Step Extraction

**Step 1: Identify MSAL Cache Keys**

Open the browser DevTools console on \`outlook.office.com\` and enumerate MSAL-related localStorage keys:

\`\`\`javascript
Object.keys(localStorage).filter(k => k.startsWith('msal.')).length
// Result at ACME Corp: 42 keys
\`\`\`

**Step 2: Extract the Refresh Token**

The refresh token is the most valuable artifact. It persists longer than access tokens and can generate new access tokens for any permitted resource:

\`\`\`javascript
const keys = Object.keys(localStorage).filter(k => k.includes('refreshtoken'))
const rtEntry = JSON.parse(localStorage.getItem(keys[0]))
// rtEntry.secret contains the plaintext refresh token
\`\`\`

**Step 3: Extract All Access Tokens**

Enumerate all cached access tokens to understand the current scope footprint:

\`\`\`javascript
const atKeys = Object.keys(localStorage).filter(k => k.includes('accesstoken'))
atKeys.forEach(k => {
  const entry = JSON.parse(localStorage.getItem(k))
  console.log(\`Resource: \${entry.environment} | Target: \${entry.target}\`)
})
\`\`\`

**Step 4: Export the Full Cache**

For offline analysis, export the complete MSAL cache:

\`\`\`javascript
const msalCache = {}
Object.keys(localStorage)
  .filter(k => k.startsWith('msal.'))
  .forEach(k => { msalCache[k] = localStorage.getItem(k) })
JSON.stringify(msalCache)
\`\`\`

### Token Format

Extracted tokens are in v2 format (JWT). The refresh token is an opaque string (not a JWT) but can be used directly with the \`/oauth2/v2.0/token\` endpoint.`,
  },
  {
    id: "scope-expansion",
    number: 5,
    title: "Scope Expansion",
    content: `### Same-Client Resource Pivoting

Using the extracted OWA refresh token (client ID: \`9199bf20-2e73-4588-8bbe-e89007112301\`), we can exchange it for access tokens targeting different resource audiences. This is not FOCI — we are using the **same client ID** but changing the **resource/audience**.

### Observed Resource Audiences

From the ACME Corp engagement, the OWA client's refresh token successfully obtained access tokens for:

| # | Resource Audience | Scopes Obtained |
|---|---|---|
| 1 | Microsoft Graph (\`graph.microsoft.com\`) | 26 scopes including Mail.Read, Files.ReadWrite, User.Read.All, Group.Read.All |
| 2 | Exchange Online (\`outlook.office365.com\`) | Mail.ReadWrite, Calendars.ReadWrite, Contacts.Read |
| 3 | Substrate (\`substrate.office.com\`) | Internal service access |
| 4 | SharePoint (\`*.sharepoint.com\`) | Sites.Read.All, Files.Read |
| 5 | Outlook REST (\`outlook.office.com\`) | Full mail API access |
| 6 | Azure AD Graph (\`graph.windows.net\`) | Directory.Read |
| 7 | Management APIs | Service health, activity feeds |

### Scope Count Summary

- **OWA apparent purpose**: Email access via Outlook Web
- **Actual scope footprint**: 50+ effective scopes across 16+ services
- **Key insight**: A single OWA refresh token provides read access to mail, files, directory, calendar, contacts, Teams messages, SharePoint sites, and administrative functions

### Exchange Mechanism

The token exchange uses a standard OAuth 2.0 refresh token grant:

\`\`\`
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id=9199bf20-2e73-4588-8bbe-e89007112301
&grant_type=refresh_token
&refresh_token={extracted_rt}
&scope=https://graph.microsoft.com/.default
\`\`\`

By changing the \`scope\` parameter to different resource audiences, the same refresh token yields access tokens for each resource.`,
  },
  {
    id: "foci-analysis",
    number: 6,
    title: "FOCI Analysis",
    content: `### FOCI Family Membership

FOCI (Family of Client IDs) enables **cross-client** token exchange. If a client is a FOCI member, its refresh token can be exchanged for tokens belonging to **other** FOCI clients. This is more powerful than same-client expansion because it unlocks entirely different application contexts.

### Confirmed FOCI Members (Family ID: 1)

| Client ID | Application | Red Team Value |
|---|---|---|
| \`1fec8e78-bce4-4aaf-ab1b-5451cc387264\` | Microsoft Teams Desktop | High — Chat, Files, Channel access |
| \`d3590ed6-52b3-4102-aeff-aad2292ab01c\` | Microsoft Office | Very High — Broadest scope set |
| \`27922004-5251-4030-b22d-91ecd9a37ea4\` | Outlook Mobile | High — Mail, Calendar, Contacts |
| \`ab9b8c07-8f02-4f72-87fa-80105867a763\` | OneDrive SyncEngine | High — Files.ReadWrite.All |
| \`4e291c71-d680-4d0e-9640-0a3358e31177\` | PowerAutomate | Medium — Flow automation |
| \`0ec893e0-5785-4de6-99da-4ed124e5296c\` | Office365 Shell WCSS | Low — Limited scopes |

### NOT FOCI Members

| Client ID | Application | Implication |
|---|---|---|
| \`9199bf20-2e73-4588-8bbe-e89007112301\` | One Outlook Web (OWA) | Cannot cross-client exchange — but same-client expansion is still devastating |
| \`5e3ce6c0-2b2f-4d57-a3cc-1cda42898555\` | Microsoft Teams Web | Cannot cross-client exchange |

### Key Distinction

The ACME Corp attack chain does **not** use FOCI. The OWA client is not a FOCI member, so cross-client exchange fails with an error. However, the same-client scope expansion demonstrated in Section 5 achieves comparable impact because the OWA client already has implicit access to a vast range of resources.

If an attacker obtains a token from a **FOCI member** (e.g., Teams Desktop on a compromised endpoint), the impact is even greater: they can exchange to any other FOCI client, unlocking the combined scope set of all family members.`,
  },
  {
    id: "service-pivot",
    number: 7,
    title: "Service Pivot Demonstration",
    content: `### ACME Corp Case Study

Starting from a single OWA browser session compromise at ACME Corp, the following services were accessed using only the extracted refresh token:

### Mail Access

Using the Graph API with \`Mail.Read\` scope:

- Enumerated **919 emails** from the compromised user's mailbox
- Accessed sent items, drafts, and archived folders
- Read email attachments without triggering additional authentication
- No distinction from normal OWA usage in standard audit logs

### Directory Enumeration

Using the Graph API with \`User.Read.All\` and \`Group.Read.All\` scopes:

- Enumerated **hundreds of Entra ID users** with full profile details (title, department, manager, phone)
- Listed **all security groups and distribution lists** with membership
- Mapped **administrative role assignments** (Global Admin, Exchange Admin, etc.)
- Identified **service principals and app registrations**

### Teams Chat Access

Using the Graph API with \`Chat.Read\` scope:

- Read **Teams 1:1 and group conversations**
- Accessed channel messages in teams the user was a member of
- Retrieved shared files from chat threads

### File Access

Using the Graph API with \`Files.Read\` and \`Sites.Read.All\` scopes:

- Browsed the user's **OneDrive contents**
- Listed **SharePoint site collections** accessible to the user
- Downloaded documents from shared drives
- Accessed files shared via Teams channels

### Calendar Intelligence

Using the Graph API with \`Calendars.Read\` scope:

- Read the user's **full calendar** including private appointments
- Enumerated meeting attendees and locations
- Accessed meeting notes and attachments
- Used scheduling data for social engineering targeting

### Total Impact

From a single OWA browser session, the attack achieved:

| Category | Data Accessed |
|---|---|
| Email | 919 messages + attachments |
| Directory | Hundreds of users, groups, roles |
| Chat | Teams conversations and shared files |
| Files | OneDrive and SharePoint documents |
| Calendar | Meeting schedules and attendee lists |
| Administrative | Role assignments and service principals |`,
  },
  {
    id: "token-lifecycle",
    number: 8,
    title: "Token Lifecycle",
    content: `### Access Token Lifetime

Access tokens issued by Entra ID have a default lifetime of **approximately 1 hour** (60-90 minutes). They are JWTs containing:

- \`aud\`: The target resource (e.g., \`https://graph.microsoft.com\`)
- \`scp\`: Granted scopes (space-delimited)
- \`exp\`: Expiration timestamp
- \`iat\`: Issue timestamp

Once expired, access tokens cannot be used. However, the refresh token can generate new access tokens indefinitely (until revoked).

### Refresh Token Behavior

SPA refresh tokens have important characteristics:

- **Rotation**: Each time a refresh token is used, a new refresh token is issued and the old one is invalidated. This creates a chain of single-use tokens.
- **Lifetime**: SPA refresh tokens typically have a 24-hour sliding window, extended by use.
- **Origin Binding**: SPA refresh tokens include an origin claim. Using them from a different origin results in error \`AADSTS9002313\` ("Cross-origin token redemption is permitted only for the 'Single-Page Application' client type").
- **Bypass**: The origin binding can be bypassed by including the \`Origin: https://outlook.office.com\` header in the token redemption request, or by using a proxy that replays from the correct origin.

### Persistence Implications

| Token Type | Lifetime | Persistence |
|---|---|---|
| Access Token | ~1 hour | Usable immediately, no renewal needed |
| Refresh Token (SPA) | 24h sliding | Requires origin header for renewal |
| Refresh Token (confidential) | Up to 90 days | Not available for SPA clients |

### Token Revocation

Refresh tokens can be revoked by:

1. Admin revoking all refresh tokens for the user (\`Revoke-AzureADUserAllRefreshToken\`)
2. User changing password (revokes all tokens)
3. Conditional Access policy change
4. Continuous Access Evaluation (CAE) near-real-time revocation

Without explicit revocation, a stolen SPA refresh token chain remains valid as long as it is refreshed within the sliding window.`,
  },
  {
    id: "detection",
    number: 9,
    title: "Defender Detection",
    content: `This section provides KQL (Kusto Query Language) queries for Microsoft Sentinel and Microsoft Defender for Cloud Apps to detect SPA token extraction and abuse.

Detection is organized into two categories:

1. **KQL Detection Queries** — Individual queries for hunting and ad-hoc investigation
2. **Sentinel Analytics Rules** — Automated detection rules for continuous monitoring

Both are provided as copyable code blocks below.`,
    specialComponent: "kql",
  },
  {
    id: "mitigations",
    number: 10,
    title: "Mitigations",
    content: `### Recommended Controls

Organizations can reduce the risk of SPA token extraction and abuse through the following controls:

### 1. Token Protection (Preview)

Microsoft's Token Protection (formerly Token Binding) binds tokens to the device that obtained them. When enabled, access tokens include a device claim that is validated server-side.

- **Status**: Public Preview for Windows devices
- **Limitation**: Not yet available for browser/SPA flows
- **Impact if available**: Would prevent extracted tokens from being used on different devices

### 2. Continuous Access Evaluation (CAE)

CAE enables near-real-time token revocation by allowing resource providers to subscribe to critical events:

- User account disabled or deleted
- Password changed
- MFA enabled
- Admin explicitly revokes tokens
- Conditional Access policy changes

**Recommendation**: Enable CAE for all users and verify it is active for Graph API and Exchange Online.

### 3. Conditional Access Policies

Implement strict Conditional Access policies:

- **Require compliant devices** for all M365 access (prevents token use from unmanaged machines)
- **Block legacy authentication** protocols
- **Enforce sign-in frequency** to limit refresh token lifetime
- **Restrict by named location** to prevent off-network token use
- **App-enforced restrictions** for SharePoint and Exchange

### 4. Browser Security

Reduce the attack surface for token extraction:

- Deploy browser extensions that prevent DevTools access on sensitive domains
- Use Enterprise Browser policies to restrict localStorage access
- Implement Content Security Policy headers that limit script execution
- Monitor for browser extension installations that request broad permissions

### 5. Detection and Monitoring

- Deploy the Sentinel detection rules from Section 9
- Enable **Sign-in logs** streaming to SIEM
- Monitor for unusual \`ResourceDisplayName\` values in OWA sign-in events
- Alert on refresh token usage from new IP addresses
- Implement anomaly detection for bulk Graph API calls

### 6. MSAL Cache Encryption

While Microsoft does not currently encrypt the MSAL browser cache, organizations can:

- Advocate for Microsoft to implement \`SubtleCrypto\`-based cache encryption
- Use Enterprise Browser managed profiles that clear localStorage on session end
- Implement session timeout policies that force re-authentication

### Defense-in-Depth Summary

| Control | Prevents Extraction | Prevents Replay | Detects Abuse |
|---|---|---|---|
| Token Protection | No | Yes (when available) | No |
| CAE | No | Partial | No |
| Conditional Access (compliant device) | No | Yes | No |
| Sign-in Frequency | No | Limits window | No |
| Browser Security | Partial | No | No |
| Sentinel Detection Rules | No | No | Yes |
| Named Locations | No | Partial | Yes |`,
  },
]

// ---------------------------------------------------------------------------
// Paper Content Component
// ---------------------------------------------------------------------------

export function PaperContent() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(PAPER_SECTIONS.map((s) => s.id))
  )
  const [activeSection, setActiveSection] = useState<string>(PAPER_SECTIONS[0].id)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedSections(new Set(PAPER_SECTIONS.map((s) => s.id)))
  const collapseAll = () => setExpandedSections(new Set())

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      // Ensure section is expanded
      setExpandedSections((prev) => new Set([...prev, id]))
    }
  }

  // Scrollspy: observe which section is in view
  const handleScroll = useCallback(() => {
    const entries = PAPER_SECTIONS.map((s) => ({
      id: s.id,
      el: sectionRefs.current[s.id],
    })).filter((e) => e.el)

    let closest = entries[0]?.id || PAPER_SECTIONS[0].id
    let closestDist = Infinity

    for (const entry of entries) {
      if (!entry.el) continue
      const rect = entry.el.getBoundingClientRect()
      const dist = Math.abs(rect.top - 80) // offset for header
      if (dist < closestDist) {
        closestDist = dist
        closest = entry.id
      }
    }

    setActiveSection(closest)
  }, [])

  useEffect(() => {
    const container = document.querySelector("[data-paper-scroll]")
    if (!container) return
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  return (
    <div className="flex gap-6">
      {/* Table of Contents — sticky sidebar */}
      <nav className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-0 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contents
            </span>
            <div className="flex gap-1">
              <button
                onClick={expandAll}
                className="text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                Expand all
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button
                onClick={collapseAll}
                className="text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                Collapse all
              </button>
            </div>
          </div>
          {PAPER_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "w-full text-left px-2 py-1 rounded text-[11px] transition-colors truncate",
                activeSection === section.id
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
              )}
            >
              <span className="font-mono text-muted-foreground mr-1.5">{section.number}.</span>
              {section.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Paper body */}
      <div className="flex-1 min-w-0 space-y-3" data-paper-scroll>
        {PAPER_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          return (
            <div
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el }}
              className="rounded-lg border border-border/50 bg-card/30"
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-muted/5 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono text-xs text-muted-foreground">{section.number}.</span>
                <span className="text-sm font-medium">{section.title}</span>
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {section.content}
                  </ReactMarkdown>

                  {/* Special component sections */}
                  {section.specialComponent === "kql" && (
                    <div className="mt-6 space-y-6">
                      <KqlQueryPack />
                      <DetectionRules />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
