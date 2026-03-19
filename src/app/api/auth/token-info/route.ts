import { getTokenFromRequest, getCredentialFromRequest, getProviderFromRequest, unauthorized, serverError } from "@/app/api/_helpers"
import { getProvider } from "@/lib/providers/registry"
import { decodeJwtPayload, decodeScopesFromJwt } from "@/lib/microsoft"
import type { MicrosoftCredential } from "@/lib/providers/types"

export async function GET(request: Request) {
  const provider = await getProviderFromRequest()
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get("refresh") === "true"

  // Microsoft provider path — JWT-based, no tokeninfo endpoint needed
  if (provider === "microsoft") {
    const cred = await getCredentialFromRequest()
    if (!cred) return unauthorized()

    const msProvider = getProvider("microsoft")
    if (!msProvider) return unauthorized()

    try {
      const accessToken = await msProvider.getAccessToken(cred.credential)
      const payload = decodeJwtPayload(accessToken)
      const scopes = decodeScopesFromJwt(accessToken)
      const msCred = cred.credential as MicrosoftCredential

      return Response.json({
        valid: true,
        expiresIn: payload?.exp
          ? Math.max(0, (payload.exp as number) - Math.floor(Date.now() / 1000))
          : 3600,
        scopes,
        email: (payload?.preferred_username as string) || (payload?.upn as string) || msCred.account || "",
        issuedAt: Date.now(),
        provider: "microsoft",
        refreshed: true,
      })
    } catch (error) {
      return Response.json({
        valid: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
        provider: "microsoft",
      })
    }
  }

  // Google path (existing logic)
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    let accessToken = token.token || ""
    let expiresIn = 0
    let refreshed = false

    if (forceRefresh || !accessToken) {
      const tokenUri = token.token_uri || "https://oauth2.googleapis.com/token"
      const refreshRes = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: token.client_id,
          client_secret: token.client_secret,
        }),
      })

      if (!refreshRes.ok) {
        const err = await refreshRes.text().catch(() => "Token refresh failed")
        return Response.json({
          valid: false,
          error: `Token refresh failed: ${err}`,
          provider: provider || "google",
        })
      }

      const refreshData = await refreshRes.json()
      accessToken = refreshData.access_token as string
      expiresIn = (refreshData.expires_in as number) || 3600
      refreshed = true
    }

    const infoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    )

    if (!infoRes.ok) {
      if (!refreshed) {
        const tokenUri = token.token_uri || "https://oauth2.googleapis.com/token"
        const refreshRes = await fetch(tokenUri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refresh_token,
            client_id: token.client_id,
            client_secret: token.client_secret,
          }),
        })

        if (!refreshRes.ok) {
          return Response.json({
            valid: false,
            error: "Access token expired and refresh failed",
            provider: provider || "google",
          })
        }

        const refreshData = await refreshRes.json()
        accessToken = refreshData.access_token as string
        expiresIn = (refreshData.expires_in as number) || 3600

        const retryRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
        )

        if (retryRes.ok) {
          const info = await retryRes.json()
          return Response.json({
            valid: true,
            expiresIn: Number(info.expires_in) || expiresIn,
            scopes: ((info.scope as string) || "").split(" ").filter(Boolean),
            email: (info.email as string) || "",
            issuedAt: Date.now(),
            provider: provider || "google",
            refreshed: true,
          })
        }
      }

      return Response.json({
        valid: false,
        error: "Unable to verify token",
        provider: provider || "google",
      })
    }

    const info = await infoRes.json()
    const scopes = ((info.scope as string) || "").split(" ").filter(Boolean)
    const email = (info.email as string) || ""

    return Response.json({
      valid: true,
      expiresIn: Number(info.expires_in) || expiresIn,
      scopes,
      email,
      issuedAt: Date.now(),
      provider: provider || "google",
      refreshed,
    })
  } catch (error) {
    return serverError(error, provider || undefined)
  }
}
