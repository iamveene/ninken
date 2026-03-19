import type {
  AccessTokenCredential,
  BaseCredential,
  ServiceProvider,
} from "./types"

function isGitLabPAT(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  return raw.trim().startsWith("glpat-")
}

function isGitLabObject(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const obj = raw as Record<string, unknown>
  if (obj.provider === "gitlab") return true
  if (typeof obj.access_token === "string" && isGitLabPAT(obj.access_token)) return true
  if (typeof obj.token === "string" && isGitLabPAT(obj.token)) return true
  return false
}

export const gitlabProvider: ServiceProvider = {
  id: "gitlab",
  name: "GitLab",
  description: "Projects, Groups, Pipelines, Snippets, Audit",
  iconName: "Gitlab",

  detectCredential(raw: unknown): boolean {
    if (isGitLabPAT(raw)) return true
    return isGitLabObject(raw)
  },

  validateCredential(
    raw: unknown,
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {
    let token: string | undefined

    if (typeof raw === "string" && isGitLabPAT(raw)) {
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
      return { valid: false, error: "Missing GitLab PAT (expected glpat-*)" }
    }

    const credential: AccessTokenCredential = {
      provider: "gitlab",
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
      const res = await fetch("https://gitlab.com/api/v4/personal_access_tokens/self", {
        headers: { "PRIVATE-TOKEN": token },
      })
      if (!res.ok) return []
      const data = await res.json() as { scopes?: string[] }
      return data.scopes || []
    } catch {
      return []
    }
  },

  emailEndpoint: "/api/gitlab/me",
  defaultRoute: "/gitlab-dashboard",

  operateNavItems: [
    { id: "gitlab-dashboard", title: "Dashboard", href: "/gitlab-dashboard", iconName: "LayoutDashboard" },
    { id: "gitlab-projects", title: "Projects", href: "/gitlab-projects", iconName: "FolderGit2" },
    { id: "gitlab-groups", title: "Groups", href: "/gitlab-groups", iconName: "Building2" },
    { id: "gitlab-pipelines", title: "Pipelines", href: "/gitlab-pipelines", iconName: "Play" },
    { id: "gitlab-snippets", title: "Snippets", href: "/gitlab-snippets", iconName: "FileCode" },
  ],

  auditNavItems: [
    { id: "gitlab-audit-dashboard", title: "Dashboard", href: "/gitlab-audit", iconName: "LayoutDashboard" },
    { id: "gitlab-audit-members", title: "Members & Roles", href: "/gitlab-audit/members", iconName: "Users" },
    { id: "gitlab-audit-project-access", title: "Project Access", href: "/gitlab-audit/project-access", iconName: "Lock" },
    { id: "gitlab-audit-runners", title: "Runners", href: "/gitlab-audit/runners", iconName: "Server" },
    { id: "gitlab-audit-variables", title: "CI/CD Variables", href: "/gitlab-audit/variables", iconName: "KeyRound" },
    { id: "gitlab-audit-deploy-tokens", title: "Deploy Tokens", href: "/gitlab-audit/deploy-tokens", iconName: "Key" },
    { id: "gitlab-audit-webhooks", title: "Webhooks", href: "/gitlab-audit/webhooks", iconName: "Webhook" },
  ],

  scopeAppMap: {
    "gitlab-projects": ["api", "read_api", "read_repository"],
    "gitlab-groups": ["api", "read_api"],
    "gitlab-pipelines": ["api", "read_api"],
    "gitlab-snippets": ["api", "read_api"],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null
    const err = error as { status?: number; message?: string; gitlabMessage?: string }
    if (typeof err.status === "number" && (err.gitlabMessage || err.message)) {
      return { status: err.status, message: err.gitlabMessage || err.message || "GitLab API error" }
    }
    return null
  },

  canRefresh(): boolean {
    return false
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as AccessTokenCredential
    return {
      provider: "gitlab",
      credentialKind: "access-token",
      access_token: c.access_token,
    } as AccessTokenCredential
  },
}
