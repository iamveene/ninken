import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubFetch, githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

// ── Raw GitHub API types ──────────────────────────────────────────────

type RawRepo = {
  id: number
  name: string
  full_name: string
  private: boolean
  fork: boolean
  archived: boolean
  default_branch: string
  owner: { login: string }
}

type RawBranchProtection = {
  required_pull_request_reviews?: unknown
  required_status_checks?: unknown
  enforce_admins?: { enabled: boolean }
  allow_force_pushes?: { enabled: boolean }
  allow_deletions?: { enabled: boolean }
}

type RawWebhook = {
  id: number
  config: { url?: string; insecure_ssl?: string }
  events: string[]
  active: boolean
}

type RawDeployKey = {
  id: number
  title: string
  read_only: boolean
  created_at: string
}

type RawRunner = {
  id: number
  name: string
  os: string
  status: string
}

type RawRunnersResponse = {
  total_count: number
  runners: RawRunner[]
}

type RawSecretsResponse = {
  total_count: number
}

type RawOrgMember = {
  login: string
  site_admin: boolean
}

type RawInstallation = {
  app_slug: string
  permissions: Record<string, string>
  repository_selection: string
}

type RawOrg = {
  login: string
}

type RawUser = {
  login: string
  two_factor_authentication?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Batch concurrent requests with a concurrency limit. Returns fulfilled results and error messages. */
async function batchConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<{ results: R[]; errors: string[] }> {
  const results: R[] = []
  const errors: string[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
      }
    }
  }
  return { results, errors }
}

/**
 * GET /api/github/audit/risk-data
 * Bulk data collection for GitHub risk assessment.
 */
export async function GET() {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    // 1. Fetch user info for 2FA status
    const userRes = await githubFetch(token, "/user")
    const rawUser = (await userRes.json()) as RawUser

    // 2. Fetch all repos (cap at 50 most recently updated)
    const allRepos = await githubPaginateAll<RawRepo>(token, "/user/repos", {
      params: { sort: "updated", direction: "desc" },
      perPage: 100,
      maxPages: 1,
    })
    const repos = allRepos.slice(0, 50)

    // 3. Fetch all orgs
    const orgs = await githubPaginateAll<RawOrg>(token, "/user/orgs", {
      perPage: 100,
      maxPages: 3,
    })

    // 4. Per-repo details (batch 5 concurrent)
    type RepoDetails = {
      name: string
      fullName: string
      private: boolean
      fork: boolean
      archived: boolean
      defaultBranch: string
      branchProtection: {
        protected: boolean
        requiredReviews: boolean
        requiredStatusChecks: boolean
        enforceAdmins: boolean
        allowForcePushes: boolean
        allowDeletions: boolean
      } | null
      webhooks: Array<{ id: number; url: string; events: string[]; active: boolean; insecureSsl: boolean }>
      deployKeys: Array<{ id: number; title: string; readOnly: boolean; createdAt: string }>
      runners: Array<{ id: number; name: string; os: string; status: string }>
      secretsCount: number
    }

    const { results: repoDetails, errors: repoErrors } = await batchConcurrent(repos, 5, async (repo): Promise<RepoDetails> => {
      const fullName = repo.full_name

      // Branch protection
      let branchProtection: RepoDetails["branchProtection"] = null
      try {
        const bpRes = await githubFetch(token, `/repos/${fullName}/branches/${repo.default_branch}/protection`)
        if (bpRes.ok) {
          const bp = (await bpRes.json()) as RawBranchProtection
          branchProtection = {
            protected: true,
            requiredReviews: bp.required_pull_request_reviews != null,
            requiredStatusChecks: bp.required_status_checks != null,
            enforceAdmins: bp.enforce_admins?.enabled ?? false,
            allowForcePushes: bp.allow_force_pushes?.enabled ?? false,
            allowDeletions: bp.allow_deletions?.enabled ?? false,
          }
        } else {
          // 404 = not protected, other errors = skip
          branchProtection = bpRes.status === 404
            ? { protected: false, requiredReviews: false, requiredStatusChecks: false, enforceAdmins: false, allowForcePushes: false, allowDeletions: false }
            : null
        }
      } catch {
        branchProtection = null
      }

      // Webhooks
      let webhooks: RepoDetails["webhooks"] = []
      try {
        const whRes = await githubFetch(token, `/repos/${fullName}/hooks`)
        if (whRes.ok) {
          const rawWebhooks = (await whRes.json()) as RawWebhook[]
          webhooks = rawWebhooks.map((w) => ({
            id: w.id,
            url: w.config.url ?? "",
            events: w.events,
            active: w.active,
            insecureSsl: w.config.insecure_ssl === "1",
          }))
        }
      } catch { /* 403 = no access, skip */ }

      // Deploy keys
      let deployKeys: RepoDetails["deployKeys"] = []
      try {
        const dkRes = await githubFetch(token, `/repos/${fullName}/keys`)
        if (dkRes.ok) {
          const rawKeys = (await dkRes.json()) as RawDeployKey[]
          deployKeys = rawKeys.map((k) => ({
            id: k.id,
            title: k.title,
            readOnly: k.read_only,
            createdAt: k.created_at,
          }))
        }
      } catch { /* skip */ }

      // Runners
      let runners: RepoDetails["runners"] = []
      try {
        const rnRes = await githubFetch(token, `/repos/${fullName}/actions/runners`)
        if (rnRes.ok) {
          const rawRunners = (await rnRes.json()) as RawRunnersResponse
          runners = (rawRunners.runners ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            os: r.os,
            status: r.status,
          }))
        }
      } catch { /* 404 = not available */ }

      // Secrets (just total_count)
      let secretsCount = 0
      try {
        const secRes = await githubFetch(token, `/repos/${fullName}/actions/secrets`)
        if (secRes.ok) {
          const rawSecrets = (await secRes.json()) as RawSecretsResponse
          secretsCount = rawSecrets.total_count ?? 0
        }
      } catch { /* skip */ }

      return {
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        fork: repo.fork,
        archived: repo.archived,
        defaultBranch: repo.default_branch,
        branchProtection,
        webhooks,
        deployKeys,
        runners,
        secretsCount,
      }
    })

    // 5. Per-org details
    type OrgMemberEntry = { login: string; role: string; org: string }
    type OrgInstallationEntry = { appSlug: string; permissions: Record<string, string>; repositorySelection: string }

    const orgMembers: OrgMemberEntry[] = []
    const orgInstallations: OrgInstallationEntry[] = []

    await batchConcurrent(orgs, 5, async (org): Promise<void> => {
      // Members
      try {
        const membersRes = await githubFetch(token, `/orgs/${org.login}/members`, {
          params: { per_page: 100, role: "admin" },
        })
        if (membersRes.ok) {
          const rawMembers = (await membersRes.json()) as RawOrgMember[]
          for (const m of rawMembers) {
            orgMembers.push({ login: m.login, role: "admin", org: org.login })
          }
        }

        // Also get regular members for completeness
        const allMembersRes = await githubFetch(token, `/orgs/${org.login}/members`, {
          params: { per_page: 100 },
        })
        if (allMembersRes.ok) {
          const allRawMembers = (await allMembersRes.json()) as RawOrgMember[]
          for (const m of allRawMembers) {
            // Only add if not already added as admin
            if (!orgMembers.some((om) => om.login === m.login && om.org === org.login)) {
              orgMembers.push({ login: m.login, role: "member", org: org.login })
            }
          }
        }
      } catch { /* skip */ }

      // Installations
      try {
        const installRes = await githubFetch(token, `/orgs/${org.login}/installations`)
        if (installRes.ok) {
          const body = (await installRes.json()) as { installations?: RawInstallation[] }
          const rawInstalls = body.installations ?? []
          for (const inst of rawInstalls) {
            orgInstallations.push({
              appSlug: inst.app_slug,
              permissions: inst.permissions,
              repositorySelection: inst.repository_selection,
            })
          }
        }
      } catch { /* skip */ }
    })

    return NextResponse.json({
      user: {
        login: rawUser.login,
        twoFactorAuthentication: rawUser.two_factor_authentication ?? null,
      },
      repos: repoDetails,
      skippedRepos: repoErrors.length,
      errors: repoErrors.length > 0 ? repoErrors : undefined,
      orgMembers,
      orgInstallations,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
