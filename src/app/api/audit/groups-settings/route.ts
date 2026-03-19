import { NextResponse } from "next/server"
import {
  createDirectoryServiceFromToken,
  createGroupsSettingsServiceFromToken,
} from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

type RiskLevel = "critical" | "high" | "medium" | "low"

type GroupSettingsResult = {
  email: string
  name: string
  whoCanJoin: string
  whoCanViewMembership: string
  whoCanPostMessage: string
  allowExternalMembers: string
  allowWebPosting: string
  isArchived: string
  membersCanPostAsTheGroup: string
  messageModerationLevel: string
  riskLevel: RiskLevel
  riskFactors: string[]
}

const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function computeRisk(settings: Record<string, string>): {
  riskLevel: RiskLevel
  riskFactors: string[]
} {
  const factors: string[] = []
  let level: RiskLevel = "low"

  const allowsExternal = settings.allowExternalMembers === "true"

  if (settings.whoCanJoin === "ANYONE_CAN_JOIN") {
    factors.push("Anyone can join")
    level = "critical"
  }

  if (allowsExternal) {
    factors.push("Allows external members")
    if (level !== "critical") level = "high"
  }

  if (settings.whoCanPostMessage === "ANYONE_CAN_POST") {
    factors.push("Anyone can post")
    if (level !== "critical") level = "high"
  }

  if (settings.messageModerationLevel === "MODERATE_NONE" && allowsExternal) {
    factors.push("No moderation with external access")
    if (level !== "critical") level = "high"
  }

  if (
    settings.whoCanViewMembership === "ALL_IN_DOMAIN_CAN_VIEW" &&
    allowsExternal
  ) {
    factors.push("Membership visible to domain with external access")
    if (level === "low") level = "medium"
  }

  if (settings.membersCanPostAsTheGroup === "true") {
    factors.push("Members can post as group")
    if (level === "low") level = "medium"
  }

  return { riskLevel: level, riskFactors: factors }
}

/**
 * GET /api/audit/groups-settings
 *
 * Fetches all groups via Directory API, then batch-fetches settings
 * for each group (10 concurrent) via Groups Settings API.
 */
export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const admin = createDirectoryServiceFromToken(accessToken)
    const groupsSettings = createGroupsSettingsServiceFromToken(accessToken)

    // Step 1: Fetch all groups from Directory API
    let allGroups: { email: string; name: string }[] = []
    try {
      let pageToken: string | undefined
      do {
        const res = await admin.groups.list({
          customer: "my_customer",
          maxResults: 200,
          pageToken,
        })

        const groups = (res.data.groups || []).map((g) => ({
          email: g.email || "",
          name: g.name || "",
        }))
        allGroups = allGroups.concat(groups)
        pageToken = res.data.nextPageToken || undefined
      } while (pageToken)
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : 0
      if (code === 403) {
        return NextResponse.json({
          groups: [],
          scope: "denied",
          skippedCount: 0,
        })
      }
      throw err
    }

    // Step 2: Batch-fetch settings for each group (10 concurrent)
    const BATCH_SIZE = 10
    const results: GroupSettingsResult[] = []
    let skippedCount = 0

    for (let i = 0; i < allGroups.length; i += BATCH_SIZE) {
      const batch = allGroups.slice(i, i + BATCH_SIZE)
      const settled = await Promise.allSettled(
        batch.map(async (group) => {
          const res = await groupsSettings.groups.get({
            groupUniqueId: group.email,
          })

          const s = res.data as Record<string, unknown>

          const whoCanJoin = String(s.whoCanJoin || "")
          const whoCanViewMembership = String(s.whoCanViewMembership || "")
          const whoCanPostMessage = String(s.whoCanPostMessage || "")
          const allowExternalMembers = String(s.allowExternalMembers || "")
          const allowWebPosting = String(s.allowWebPosting || "")
          const isArchived = String(s.isArchived || "")
          const membersCanPostAsTheGroup = String(s.membersCanPostAsTheGroup || "")
          const messageModerationLevel = String(s.messageModerationLevel || "")

          const { riskLevel, riskFactors } = computeRisk({
            whoCanJoin,
            whoCanViewMembership,
            whoCanPostMessage,
            allowExternalMembers,
            allowWebPosting,
            isArchived,
            membersCanPostAsTheGroup,
            messageModerationLevel,
          })

          return {
            email: group.email,
            name: group.name,
            whoCanJoin,
            whoCanViewMembership,
            whoCanPostMessage,
            allowExternalMembers,
            allowWebPosting,
            isArchived,
            membersCanPostAsTheGroup,
            messageModerationLevel,
            riskLevel,
            riskFactors,
          } satisfies GroupSettingsResult
        })
      )

      for (const result of settled) {
        if (result.status === "fulfilled") {
          results.push(result.value)
        } else {
          // Skip groups where settings fetch failed (e.g. 403)
          skippedCount++
        }
      }
    }

    // Sort: critical first, then high, medium, low
    results.sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel])

    return NextResponse.json({
      groups: results,
      scope: "organization",
      skippedCount,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
