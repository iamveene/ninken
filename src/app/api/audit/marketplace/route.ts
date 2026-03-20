import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/audit/marketplace
 *
 * Lists third-party OAuth tokens (marketplace/connected apps) for users.
 * Uses the Admin Directory API tokens endpoint.
 * Falls back gracefully if admin access is denied.
 */
export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const admin = createDirectoryServiceFromToken(accessToken)
    let scope: "organization" | "limited" = "organization"

    // First, get user list to enumerate tokens per user
    const appMap = new Map<string, {
      clientId: string
      displayText: string
      scopes: Set<string>
      userCount: number
      users: string[]
      nativeApp: boolean
    }>()

    try {
      // List users first (limited to prevent timeout)
      const usersRes = await admin.users.list({
        customer: "my_customer",
        maxResults: 100,
        projection: "basic",
        orderBy: "email",
      })

      const users = usersRes.data.users || []

      // Fetch tokens for each user (in parallel batches)
      const batchSize = 10
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map((u) =>
            admin.tokens.list({ userKey: u.primaryEmail! })
          )
        )

        for (let j = 0; j < results.length; j++) {
          const result = results[j]
          if (result.status !== "fulfilled") continue
          const tokens = result.value.data.items || []
          const userEmail = batch[j].primaryEmail || ""

          for (const t of tokens) {
            const clientId = t.clientId || ""
            const existing = appMap.get(clientId)
            if (existing) {
              existing.userCount++
              if (existing.users.length < 5) existing.users.push(userEmail)
              for (const s of t.scopes || []) existing.scopes.add(s)
            } else {
              appMap.set(clientId, {
                clientId,
                displayText: t.displayText || clientId,
                scopes: new Set(t.scopes || []),
                userCount: 1,
                users: [userEmail],
                nativeApp: t.nativeApp || false,
              })
            }
          }
        }
      }
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err
        ? (err as { code: number }).code : 0
      if (code === 403) {
        scope = "limited"
      } else {
        throw err
      }
    }

    const apps = Array.from(appMap.values()).map((a) => ({
      clientId: a.clientId,
      displayText: a.displayText,
      scopes: Array.from(a.scopes),
      userCount: a.userCount,
      sampleUsers: a.users,
      nativeApp: a.nativeApp,
    }))

    // Sort by user count descending
    apps.sort((a, b) => b.userCount - a.userCount)

    return NextResponse.json({
      apps,
      totalApps: apps.length,
      scope,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
