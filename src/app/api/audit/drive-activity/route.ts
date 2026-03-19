import { NextResponse } from "next/server"
import type { driveactivity_v2 } from "googleapis"
import { createDriveActivityServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

type ActionDetail = driveactivity_v2.Schema$ActionDetail

/**
 * GET /api/audit/drive-activity
 *
 * Queries Drive Activity API for file-level audit events.
 * Supports pagination and filtering by action type.
 * Returns 403-safe degraded response when scope is denied.
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "50", 10),
      100
    )
    const pageToken = searchParams.get("pageToken") || undefined
    const filter = searchParams.get("filter") || undefined

    const service = createDriveActivityServiceFromToken(accessToken)

    const res = await service.activity.query({
      requestBody: {
        pageSize,
        pageToken,
        filter,
        consolidationStrategy: { none: {} },
      },
    })

    const activities = (res.data.activities || []).map((activity) => {
      const timestamp =
        activity.timestamp ||
        activity.timeRange?.endTime ||
        activity.timeRange?.startTime ||
        null

      const actors = (activity.actors || []).map((actor) => {
        if (actor.user?.knownUser?.personName) {
          return {
            type: "user" as const,
            displayName: actor.user.knownUser.personName,
            email: actor.user.knownUser.personName,
          }
        }
        if (actor.user?.unknownUser) {
          return { type: "user" as const, displayName: "Unknown user" }
        }
        if (actor.administrator) {
          return { type: "system" as const, displayName: "Administrator" }
        }
        if (actor.system) {
          return {
            type: "system" as const,
            displayName: actor.system.type || "System",
          }
        }
        if (actor.impersonation) {
          return { type: "user" as const, displayName: "Impersonated user" }
        }
        return { type: "system" as const, displayName: "Unknown" }
      })

      const actionDetail: ActionDetail = activity.primaryActionDetail || {}
      const actionType = extractActionType(actionDetail)

      const targets = (activity.targets || []).map((target) => {
        if (target.driveItem) {
          return {
            type: "driveItem" as const,
            name: target.driveItem.name || "",
            title: target.driveItem.title || "",
            mimeType: target.driveItem.mimeType || "",
          }
        }
        if (target.teamDrive) {
          return {
            type: "teamDrive" as const,
            name: target.teamDrive.name || "",
            title: target.teamDrive.title || "",
          }
        }
        if (target.fileComment) {
          return {
            type: "driveItem" as const,
            name: target.fileComment.parent?.name || "",
            title: target.fileComment.parent?.title || "",
            mimeType: "",
          }
        }
        return {
          type: "driveItem" as const,
          name: "",
          title: "Unknown target",
        }
      })

      const isPermissionChange = actionType === "permissionChange"
      const isExternalShare = detectExternalShare(actionDetail)

      return {
        timestamp,
        actors,
        actionType,
        targets,
        isPermissionChange,
        isExternalShare,
      }
    })

    return NextResponse.json({
      activities,
      nextPageToken: res.data.nextPageToken || null,
      scope: "granted",
    })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: number }).code
        : 0
    if (code === 403) {
      return NextResponse.json({
        activities: [],
        nextPageToken: null,
        scope: "denied",
      })
    }
    return serverError(error)
  }
}

function extractActionType(detail: ActionDetail): string {
  const actionKeys = [
    "create",
    "edit",
    "move",
    "rename",
    "delete",
    "restore",
    "permissionChange",
    "comment",
    "dlpChange",
    "reference",
    "settingsChange",
  ] as const

  for (const key of actionKeys) {
    if (detail[key] !== undefined && detail[key] !== null) {
      return key
    }
  }
  return "unknown"
}

function detectExternalShare(detail: ActionDetail): boolean {
  const permChange = detail.permissionChange
  if (!permChange?.addedPermissions) return false

  for (const perm of permChange.addedPermissions) {
    if (perm.anyone) return true
    if (perm.domain) return true
  }
  return false
}
