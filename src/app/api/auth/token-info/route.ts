import { getCredentialFromRequest, unauthorized, serverError } from "@/app/api/_helpers"
import { getProvider } from "@/lib/providers/registry"
import { decodeJwtPayload, decodeScopesFromJwt } from "@/lib/microsoft"
import type { MicrosoftCredential } from "@/lib/providers/types"

export async function GET(request: Request) {
  const cred = await getCredentialFromRequest()
  if (!cred) return unauthorized()

  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get("refresh") === "true"

  const provider = getProvider(cred.provider)
  if (!provider) return unauthorized()

  // Microsoft provider path — JWT-based, no tokeninfo endpoint needed
  if (cred.provider === "microsoft") {
    try {
      const accessToken = await provider.getAccessToken(cred.credential)
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

  // Google path — uses provider.getAccessToken() for a fresh token
  try {
    let accessToken: string
    try {
      accessToken = await provider.getAccessToken(cred.credential)
    } catch {
      return Response.json({
        valid: false,
        error: "Token refresh failed",
        provider: "google",
      })
    }

    const infoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    )

    if (!infoRes.ok) {
      if (!forceRefresh) {
        // Token may have just expired — force a fresh one
        try {
          accessToken = await provider.getAccessToken(cred.credential)
        } catch {
          return Response.json({
            valid: false,
            error: "Access token expired and refresh failed",
            provider: "google",
          })
        }

        const retryRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
        )

        if (retryRes.ok) {
          const info = await retryRes.json()
          return Response.json({
            valid: true,
            expiresIn: Number(info.expires_in) || 3600,
            scopes: ((info.scope as string) || "").split(" ").filter(Boolean),
            email: (info.email as string) || "",
            issuedAt: Date.now(),
            provider: "google",
            refreshed: true,
          })
        }
      }

      return Response.json({
        valid: false,
        error: "Unable to verify token",
        provider: "google",
      })
    }

    const info = await infoRes.json()
    const scopes = ((info.scope as string) || "").split(" ").filter(Boolean)
    const email = (info.email as string) || ""

    return Response.json({
      valid: true,
      expiresIn: Number(info.expires_in) || 3600,
      scopes,
      email,
      issuedAt: Date.now(),
      provider: "google",
      refreshed: forceRefresh,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
