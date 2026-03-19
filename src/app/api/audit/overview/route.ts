import { NextResponse } from "next/server"
import { createGmailServiceFromToken, createDriveServiceFromToken, createCalendarServiceFromToken, createStorageServiceFromToken, createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "@/app/api/_helpers"

/**
 * GET /api/audit/overview
 *
 * Probes what the current token can access across all Google services.
 * No admin permissions required — this audits from the token owner's perspective.
 */
export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    // Get token scopes
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`)
    const tokenInfo = tokenInfoRes.ok ? await tokenInfoRes.json() : {}
    const scopes = (tokenInfo.scope || "").split(" ").filter(Boolean)
    const expiresIn = tokenInfo.expires_in ? Number(tokenInfo.expires_in) : null

    // Probe all services in parallel — catch errors per service
    const [gmailResult, driveResult, calendarResult, storageResult, directoryResult] = await Promise.allSettled([
      // Gmail: profile + message count
      (async () => {
        const gmail = createGmailServiceFromToken(accessToken)
        const profile = await gmail.users.getProfile({ userId: "me" })
        const labels = await gmail.users.labels.list({ userId: "me" })
        return {
          accessible: true,
          email: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal,
          labelCount: labels.data.labels?.length ?? 0,
        }
      })(),
      // Drive: file count + shared drives
      (async () => {
        const drive = createDriveServiceFromToken(accessToken)
        const files = await drive.files.list({ pageSize: 1, q: "trashed = false", fields: "nextPageToken", supportsAllDrives: true })
        const shared = await drive.drives.list({ pageSize: 100, fields: "drives(id)" })
        return {
          accessible: true,
          hasFiles: !!files.data.nextPageToken || true,
          sharedDriveCount: shared.data.drives?.length ?? 0,
        }
      })(),
      // Calendar: calendar count
      (async () => {
        const cal = createCalendarServiceFromToken(accessToken)
        const calendars = await cal.calendarList.list()
        return {
          accessible: true,
          calendarCount: calendars.data.items?.length ?? 0,
        }
      })(),
      // GCP Storage: project + bucket counts
      (async () => {
        const storage = createStorageServiceFromToken(accessToken)
        // We can't list projects without resource manager, so use the projects API
        const crmRes = await fetch("https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=1000", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        let projectCount = 0
        let accessibleProjects = 0
        if (crmRes.ok) {
          const data = await crmRes.json()
          projectCount = data.projects?.length ?? 0
          // Quick probe: count how many we can list buckets for (sample first 10)
          const sample = (data.projects || []).slice(0, 10)
          const checks = await Promise.allSettled(
            sample.map(async (p: { projectId: string }) => {
              await storage.buckets.list({ project: p.projectId, maxResults: 1 })
              return true
            })
          )
          const accessibleSample = checks.filter(r => r.status === "fulfilled").length
          accessibleProjects = Math.round((accessibleSample / Math.max(sample.length, 1)) * projectCount)
        }
        return {
          accessible: true,
          projectCount,
          accessibleProjectsEstimate: accessibleProjects,
        }
      })(),
      // Directory: try to list users (admin only)
      (async () => {
        const admin = createDirectoryServiceFromToken(accessToken)
        const res = await admin.users.list({ customer: "my_customer", maxResults: 1, projection: "basic" })
        return {
          accessible: true,
          hasAdminAccess: true,
          userCountEstimate: res.data.users?.length ?? 0,
        }
      })(),
    ])

    return NextResponse.json({
      tokenInfo: {
        scopes,
        scopeCount: scopes.length,
        expiresInSeconds: expiresIn,
        email: tokenInfo.email || null,
      },
      gmail: gmailResult.status === "fulfilled" ? gmailResult.value : { accessible: false },
      drive: driveResult.status === "fulfilled" ? driveResult.value : { accessible: false },
      calendar: calendarResult.status === "fulfilled" ? calendarResult.value : { accessible: false },
      storage: storageResult.status === "fulfilled" ? storageResult.value : { accessible: false },
      directory: directoryResult.status === "fulfilled" ? directoryResult.value : { accessible: false, hasAdminAccess: false },
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
