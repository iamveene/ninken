import { NextResponse } from "next/server"
import { getMicrosoftCredential, badRequest, unauthorized, serverError } from "@/app/api/_helpers"
import { isFociClient, getFociClient } from "@/lib/studio/foci-clients"

/**
 * POST /api/studio/exchange
 * FOCI token exchange: use the active Microsoft refresh token to obtain an access token
 * for a different FOCI-family client application.
 *
 * Body: { target_client_id: string, scope?: string }
 *
 * This only works when:
 * 1. A Microsoft credential is active
 * 2. The target_client_id is in the FOCI family
 * 3. The active refresh token was obtained from a FOCI app
 */
export async function POST(request: Request) {
  let body: { target_client_id?: string; scope?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const { target_client_id, scope } = body
  if (!target_client_id || typeof target_client_id !== "string") {
    return badRequest("Missing or invalid 'target_client_id' field")
  }

  // Validate target is a known FOCI client
  if (!isFociClient(target_client_id)) {
    return badRequest(`Client ID '${target_client_id}' is not a known FOCI family member`)
  }

  const fociClient = getFociClient(target_client_id)

  // Get active Microsoft credential
  const credential = await getMicrosoftCredential()
  if (!credential) {
    return unauthorized()
  }

  // Determine scope to request
  const requestScope = scope || fociClient?.notableScopes.join(" ") || "openid profile offline_access"

  try {
    const tokenUri =
      credential.token_uri ||
      `https://login.microsoftonline.com/${credential.tenant_id}/oauth2/v2.0/token`

    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh_token,
        client_id: target_client_id,
        scope: requestScope,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Token exchange failed")
      let errorDetail: string
      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = errorJson.error_description || errorJson.error || errorText
      } catch {
        errorDetail = errorText
      }

      return NextResponse.json(
        {
          error: "FOCI exchange failed",
          detail: errorDetail,
          target_client: fociClient?.name ?? target_client_id,
          hint: "The refresh token may not be from a FOCI-compatible app, or the target app may not be available in this tenant.",
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 400 }
      )
    }

    const data = await res.json()

    return NextResponse.json({
      success: true,
      target_client: fociClient?.name ?? target_client_id,
      target_client_id,
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      scope: data.scope,
      refresh_token: data.refresh_token || null,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
