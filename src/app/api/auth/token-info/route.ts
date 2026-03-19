import { getTokenFromRequest, getProviderFromRequest, unauthorized, serverError } from "@/app/api/_helpers"

export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  const provider = await getProviderFromRequest()
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get("refresh") === "true"

  try {
    let accessToken = token.token || ""
    let expiresIn = 0
    let refreshed = false

    // Only call the refresh endpoint when forced or when there's no existing access token
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

    // Get token info (scopes, email, expiry)
    const infoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    )

    if (!infoRes.ok) {
      // Token might be expired — try a refresh
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

        // Retry tokeninfo with fresh token
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
