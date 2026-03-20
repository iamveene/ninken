import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated, graphJson } from "@/lib/microsoft"
import type { MicrosoftCredential } from "@/lib/providers/types"

export const dynamic = "force-dynamic"

type GraphUser = {
  id: string
  displayName: string
  userPrincipalName: string
}

type GraphAuthMethod = {
  "@odata.type": string
  id: string
  displayName?: string
  phoneNumber?: string
  phoneType?: string
  createdDateTime?: string
}

type UserWithMethods = GraphUser & { methods: GraphAuthMethod[] }

const BATCH_SIZE = 10

/**
 * Fetch authentication methods for a list of users, batching concurrent requests.
 */
async function fetchMethodsForUsers(
  credential: MicrosoftCredential,
  users: GraphUser[]
): Promise<UserWithMethods[]> {
  const results: UserWithMethods[] = []

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (user) => {
        const res = await graphJson<{ value: GraphAuthMethod[] }>(
          credential,
          `/users/${user.id}/authentication/methods`
        )
        return { ...user, methods: res.value || [] }
      })
    )

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value)
      }
      // Skip users where the per-user fetch failed (permission, not found, etc.)
    }
  }

  return results
}

/**
 * Try to paginate all tenant users. Returns null if access is denied (403/401).
 */
async function tryFetchAllUsers(credential: MicrosoftCredential): Promise<GraphUser[] | null> {
  try {
    const users: GraphUser[] = []
    let pageToken: string | undefined
    do {
      const result = await graphPaginated<GraphUser>(credential, "/users", {
        select: "id,displayName,userPrincipalName",
        top: 999,
        pageToken,
      })
      users.push(...result.value)
      pageToken = result.nextPageToken ?? undefined
    } while (pageToken)
    return users
  } catch (err) {
    // 403/401 from graphJson throws with a .status property
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status: number }).status
      if (status === 403 || status === 401) return null
    }
    // Other errors (network, etc.) — also fall back to /me
    return null
  }
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    // Step 1: Try to enumerate all users (returns null on 403/401)
    const users = await tryFetchAllUsers(credential)

    // Step 2: Fetch auth methods
    if (users === null) {
      // Fallback: only the current user
      const [meRes, methodsRes] = await Promise.all([
        graphJson<GraphUser>(credential, "/me?$select=id,displayName,userPrincipalName"),
        graphJson<{ value: GraphAuthMethod[] }>(credential, "/me/authentication/methods"),
      ])

      return NextResponse.json({
        scope: "me",
        users: [{ ...meRes, methods: methodsRes.value || [] }],
      })
    }

    // Tenant scope: batch-fetch methods for all users
    const usersWithMethods = await fetchMethodsForUsers(credential, users)

    return NextResponse.json({
      scope: "tenant",
      users: usersWithMethods,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
