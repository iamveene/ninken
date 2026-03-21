import { NextRequest, NextResponse } from "next/server"
import type { ProviderId, BaseCredential, AccessTokenCredential, MicrosoftCredential, SlackCredential } from "@/lib/providers/types"
import { getProvider } from "@/lib/providers/registry"
import "@/lib/providers"

// IDs to exclude from graph nodes (dashboards aren't services)
const EXCLUDED_IDS = new Set(["github-dashboard", "dashboard"])

type ServiceStat = {
  label: string
  value: number | string | null
}

async function fetchServiceStats(
  provider: ProviderId,
  credential: BaseCredential,
  accessToken: string,
  activeServiceIds: Set<string>,
): Promise<Record<string, ServiceStat>> {
  const stats: Record<string, ServiceStat> = {}

  try {
    if (provider === "google") {
      const tasks: Promise<void>[] = []

      if (activeServiceIds.has("gmail")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                const data = await res.json()
                stats["gmail"] = { label: "messages", value: data.messagesTotal ?? 0 }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("drive")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=nextPageToken&q=trashed%3Dfalse",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                // Drive doesn't return total count easily; use About endpoint
                const aboutRes = await fetch(
                  "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )
                if (aboutRes.ok) {
                  const about = await aboutRes.json()
                  const usedGB = (Number(about.storageQuota?.usage ?? 0) / (1024 ** 3)).toFixed(1)
                  stats["drive"] = { label: "used", value: `${usedGB} GB` }
                }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("calendar")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&fields=items(id)",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                const data = await res.json()
                stats["calendar"] = { label: "calendars", value: data.items?.length ?? 0 }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("directory")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://admin.googleapis.com/admin/directory/v1/users?maxResults=1&customer=my_customer",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                const data = await res.json()
                stats["directory"] = { label: "users", value: data.totalResults ?? 0 }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("chat")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://chat.googleapis.com/v1/spaces?pageSize=1000&filter=spaceType%3D%22SPACE%22",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                const data = await res.json()
                stats["chat"] = { label: "spaces", value: data.spaces?.length ?? 0 }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("buckets")) {
        // Buckets need a project ID — we'll count GCS projects via resource manager
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=100&filter=lifecycleState%3DACTIVE",
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              if (res.ok) {
                const data = await res.json()
                stats["buckets"] = { label: "projects", value: data.projects?.length ?? 0 }
              }
            } catch {}
          })()
        )
      }

      await Promise.allSettled(tasks)
    }

    if (provider === "github") {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }
      const tasks: Promise<void>[] = []

      if (activeServiceIds.has("repos")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch("https://api.github.com/user", { headers })
              if (res.ok) {
                const data = await res.json()
                stats["repos"] = { label: "repos", value: (data.public_repos ?? 0) + (data.total_private_repos ?? 0) }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("orgs")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch("https://api.github.com/user/orgs?per_page=1", { headers })
              if (res.ok) {
                const data = await res.json()
                // Use Link header for total if available, otherwise count
                stats["orgs"] = { label: "orgs", value: data.length ?? 0 }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("gists")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch("https://api.github.com/user", { headers })
              if (res.ok) {
                const data = await res.json()
                stats["gists"] = { label: "gists", value: data.public_gists ?? 0 }
              }
            } catch {}
          })()
        )
      }

      await Promise.allSettled(tasks)
    }

    if (provider === "microsoft") {
      const msCred = credential as MicrosoftCredential
      const tasks: Promise<void>[] = []

      if (activeServiceIds.has("outlook")) {
        tasks.push(
          (async () => {
            try {
              const { graphJson } = await import("@/lib/microsoft")
              const data = await graphJson<any>(msCred, "/me/mailFolders/Inbox?$select=unreadItemCount,totalItemCount")
              stats["outlook"] = { label: "unread", value: data.unreadItemCount ?? 0 }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("onedrive")) {
        tasks.push(
          (async () => {
            try {
              const { graphJson } = await import("@/lib/microsoft")
              const data = await graphJson<any>(msCred, "/me/drive?$select=quota")
              const usedGB = (Number(data.quota?.used ?? 0) / (1024 ** 3)).toFixed(1)
              stats["onedrive"] = { label: "used", value: `${usedGB} GB` }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("teams")) {
        tasks.push(
          (async () => {
            try {
              const { graphJson } = await import("@/lib/microsoft")
              const data = await graphJson<any>(msCred, "/me/joinedTeams?$select=id")
              stats["teams"] = { label: "teams", value: data.value?.length ?? 0 }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("entra")) {
        tasks.push(
          (async () => {
            try {
              const { graphJson } = await import("@/lib/microsoft")
              const data = await graphJson<any>(msCred, "/users/$count", {
                headers: { ConsistencyLevel: "eventual" },
              })
              stats["entra"] = { label: "users", value: typeof data === "number" ? data : 0 }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("sharepoint")) {
        tasks.push(
          (async () => {
            try {
              const { graphJson } = await import("@/lib/microsoft")
              const data = await graphJson<any>(msCred, "/sites?search=*&$top=1&$select=id")
              stats["sharepoint"] = { label: "sites", value: data.value?.length ?? 0 }
            } catch {}
          })()
        )
      }

      await Promise.allSettled(tasks)
    }

    if (provider === "gitlab") {
      const headers = { "PRIVATE-TOKEN": accessToken }
      const tasks: Promise<void>[] = []

      if (activeServiceIds.has("gitlab-projects")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://gitlab.com/api/v4/projects?membership=true&per_page=1",
                { headers }
              )
              if (res.ok) {
                const total = res.headers.get("x-total") ?? "0"
                stats["gitlab-projects"] = { label: "projects", value: parseInt(total) }
              }
            } catch {}
          })()
        )
      }

      if (activeServiceIds.has("gitlab-groups")) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(
                "https://gitlab.com/api/v4/groups?per_page=1",
                { headers }
              )
              if (res.ok) {
                const total = res.headers.get("x-total") ?? "0"
                stats["gitlab-groups"] = { label: "groups", value: parseInt(total) }
              }
            } catch {}
          })()
        )
      }

      await Promise.allSettled(tasks)
    }

    if (provider === "slack") {
      // Slack stats are harder without the full credential bootstrap
      // We'll attempt with the xoxc token if available
      const slackCred = credential as SlackCredential
      if ("xoxc_token" in slackCred || "access_token" in slackCred) {
        const token = "xoxc_token" in slackCred ? slackCred.xoxc_token : (slackCred as any).access_token
        const tasks: Promise<void>[] = []

        if (activeServiceIds.has("channels")) {
          tasks.push(
            (async () => {
              try {
                const { slackFetch } = await import("@/lib/slack")
                const res = await slackFetch(slackCred, "conversations.list", { limit: 1 })
                if (res.ok) {
                  const data = await res.json()
                  // Slack doesn't return total easily, use what we get
                  stats["channels"] = { label: "channels", value: data.channels?.length ?? 0 }
                }
              } catch {}
            })()
          )
        }

        await Promise.allSettled(tasks)
      }
    }
  } catch {
    // Stats are best-effort, don't fail the whole request
  }

  return stats
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, credential } = body as {
      provider: ProviderId
      credential: BaseCredential
    }

    if (!provider || !credential) {
      return NextResponse.json(
        { error: "Missing provider or credential" },
        { status: 400 }
      )
    }

    const providerConfig = getProvider(provider)
    if (!providerConfig) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      )
    }

    // Fetch scopes
    const scopes = await providerConfig.fetchScopes(credential)

    // Build services list (excluding dashboards)
    const services = providerConfig.operateNavItems
      .filter((item) => !EXCLUDED_IDS.has(item.id) && !item.id.endsWith("-dashboard"))
      .map((item) => {
        const requiredScopes = providerConfig.scopeAppMap[item.id] ?? []
        const grantedScopes = requiredScopes.filter((s) => scopes.includes(s))
        return {
          serviceId: item.id,
          serviceName: item.title,
          iconName: item.iconName,
          href: item.href,
          active: grantedScopes.length > 0,
          scopeCount: grantedScopes.length,
          grantedScopes,
          allScopes: requiredScopes,
        }
      })

    // Determine active services for stats fetching
    const activeServiceIds = new Set(
      services.filter((s) => s.active).map((s) => s.serviceId)
    )

    // Get access token for stats fetching
    let accessToken = ""
    try {
      accessToken = await providerConfig.getAccessToken(credential)
    } catch {}

    // Fetch operational stats for active services
    const stats = accessToken
      ? await fetchServiceStats(provider, credential, accessToken, activeServiceIds)
      : {}

    return NextResponse.json({ scopes, services, stats })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scope fetch failed" },
      { status: 500 }
    )
  }
}
