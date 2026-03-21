import type {
  AccessTokenCredential,
  BaseCredential,
  ServiceProvider,
} from "./types"

function isGitHubPAT(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  const trimmed = raw.trim()
  return (
    trimmed.startsWith("ghp_") ||
    trimmed.startsWith("github_pat_") ||
    trimmed.startsWith("gho_") ||
    trimmed.startsWith("ghu_") ||
    trimmed.startsWith("ghs_")
  )
}

function isGitHubObject(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const obj = raw as Record<string, unknown>
  if (obj.provider === "github") return true
  if (typeof obj.access_token === "string" && isGitHubPAT(obj.access_token)) return true
  if (typeof obj.token === "string" && isGitHubPAT(obj.token)) return true
  return false
}

export const githubProvider: ServiceProvider = {
  id: "github",
  name: "GitHub",
  description: "Repos, Orgs, Actions, Gists, Audit",
  iconName: "Github",

  detectCredential(raw: unknown): boolean {
    if (isGitHubPAT(raw)) return true
    return isGitHubObject(raw)
  },

  validateCredential(
    raw: unknown,
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {
    let token: string | undefined

    if (typeof raw === "string" && isGitHubPAT(raw)) {
      token = raw.trim()
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      token =
        typeof obj.access_token === "string"
          ? obj.access_token
          : typeof obj.token === "string"
            ? obj.token
            : undefined
    }

    if (!token) {
      return { valid: false, error: "Missing GitHub PAT (expected ghp_*, github_pat_*, gho_*, ghu_*, or ghs_*)" }
    }

    const credential: AccessTokenCredential = {
      provider: "github",
      credentialKind: "access-token",
      access_token: token,
    }

    return { valid: true, credential }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    return (credential as AccessTokenCredential).access_token
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const token = await this.getAccessToken(credential)
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
      const scopes = res.headers.get("X-OAuth-Scopes")
      if (scopes) return scopes.split(",").map((s) => s.trim()).filter(Boolean)
      return []
    } catch {
      return []
    }
  },

  emailEndpoint: "/api/github/me",
  defaultRoute: "/github-dashboard",

  operateNavItems: [
    { id: "github-dashboard", title: "Dashboard", href: "/github-dashboard", iconName: "LayoutDashboard" },
    { id: "repos", title: "Repos", href: "/repos", iconName: "BookMarked" },
    { id: "orgs", title: "Organizations", href: "/orgs", iconName: "Building2" },
    { id: "actions", title: "Actions", href: "/actions", iconName: "Play" },
    { id: "gists", title: "Gists", href: "/gists", iconName: "FileCode" },
    { id: "secret-search", title: "Secret Search", href: "/github-secret-search", iconName: "ScanSearch" },
  ],

  auditNavItems: [
    { id: "github-audit-dashboard", title: "Dashboard", href: "/github-audit", iconName: "LayoutDashboard" },
    { id: "github-audit-members", title: "Members & Roles", href: "/github-audit/members", iconName: "Users" },
    { id: "github-audit-repo-access", title: "Repo Access", href: "/github-audit/repo-access", iconName: "Lock" },
    { id: "github-audit-branch-protections", title: "Branch Protections", href: "/github-audit/branch-protections", iconName: "GitBranch" },
    { id: "github-audit-webhooks", title: "Webhooks", href: "/github-audit/webhooks", iconName: "Webhook" },
    { id: "github-audit-deploy-keys", title: "Deploy Keys", href: "/github-audit/deploy-keys", iconName: "Key" },
    { id: "github-audit-apps", title: "Apps", href: "/github-audit/apps", iconName: "AppWindow" },
    { id: "github-audit-actions-security", title: "Actions Security", href: "/github-audit/actions-security", iconName: "ShieldCheck" },
    { id: "github-audit-secrets", title: "Secrets", href: "/github-audit/secrets", iconName: "KeyRound" },
    { id: "github-audit-dependabot", title: "Dependabot", href: "/github-audit/dependabot", iconName: "Bug" },
    { id: "github-audit-code-scanning", title: "Code Scanning", href: "/github-audit/code-scanning", iconName: "Search" },
  ],

  scopeAppMap: {
    repos: ["repo", "public_repo"],
    orgs: ["read:org", "admin:org"],
    actions: ["workflow", "actions"],
    gists: ["gist"],
    "secret-search": ["repo", "public_repo", "read:org", "gist"],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null
    const err = error as { status?: number; message?: string }
    if (typeof err.status === "number" && err.message) {
      return { status: err.status, message: err.message }
    }
    return null
  },

  canRefresh(): boolean {
    return false
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as AccessTokenCredential
    return {
      provider: "github",
      credentialKind: "access-token",
      access_token: c.access_token,
    } as AccessTokenCredential
  },
}
