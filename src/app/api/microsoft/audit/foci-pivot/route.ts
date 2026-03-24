import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { FOCI_CLIENTS } from "@/lib/studio/foci-clients"
import { decodeScopesFromJwt } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type FociPivotResult = {
  clientId: string
  clientName: string
  success: boolean
  scopes: string[]
  error?: string
}

/**
 * POST /api/microsoft/audit/foci-pivot
 *
 * Probes every FOCI client ID by attempting a refresh_token exchange.
 * Returns discovered scopes per client and a unified scope matrix.
 */
export async function POST() {
  const credential = await getMicrosoftCredential()
  if (!credential) {
    return unauthorized()
  }

  try {
    if (!credential.refresh_token) {
      return NextResponse.json(
        { error: "FOCI pivot requires a refresh token credential" },
        { status: 400 },
      )
    }

    const refreshToken = credential.refresh_token
    const tokenUri =
      credential.token_uri ||
      `https://login.microsoftonline.com/${credential.tenant_id}/oauth2/v2.0/token`

    const results = await Promise.allSettled(
      FOCI_CLIENTS.map(async (fociClient): Promise<FociPivotResult> => {
        const res = await fetch(tokenUri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: fociClient.clientId,
            scope: "https://graph.microsoft.com/.default offline_access",
          }),
        })

        if (!res.ok) {
          const errorText = await res.text().catch(() => "Token exchange failed")
          let errorDetail: string
          try {
            const errorJson = JSON.parse(errorText)
            errorDetail =
              errorJson.error_description || errorJson.error || errorText
          } catch {
            errorDetail = errorText
          }
          return {
            clientId: fociClient.clientId,
            clientName: fociClient.name,
            success: false,
            scopes: [],
            error: errorDetail,
          }
        }

        const data = await res.json()
        const accessToken = data.access_token as string | undefined
        const scopes = accessToken ? decodeScopesFromJwt(accessToken) : []

        return {
          clientId: fociClient.clientId,
          clientName: fociClient.name,
          success: true,
          scopes,
        }
      })
    )

    const pivotResults: FociPivotResult[] = results.map((r) => {
      if (r.status === "fulfilled") return r.value
      return {
        clientId: "unknown",
        clientName: "Unknown",
        success: false,
        scopes: [],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      }
    })

    // Build unique scope set and scope-to-client matrix
    const scopeMatrix: Record<string, string[]> = {}
    for (const result of pivotResults) {
      if (!result.success) continue
      for (const scope of result.scopes) {
        if (!scopeMatrix[scope]) {
          scopeMatrix[scope] = []
        }
        scopeMatrix[scope].push(result.clientId)
      }
    }

    const uniqueScopes = Object.keys(scopeMatrix).sort()

    return NextResponse.json({
      credentialClientId: credential.client_id,
      results: pivotResults,
      uniqueScopes,
      scopeMatrix,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
