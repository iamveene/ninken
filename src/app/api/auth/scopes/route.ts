import { NextResponse } from "next/server"
import { getCredentialFromRequest, getTokenFromRequest, unauthorized, serverError } from "@/app/api/_helpers"
import { getProvider } from "@/lib/providers/registry"
import { OAuth2Client } from "google-auth-library"

export async function GET() {
  // Try provider-generic path first
  const cred = await getCredentialFromRequest()
  if (cred) {
    const provider = getProvider(cred.provider)
    if (provider) {
      try {
        const scopes = await provider.fetchScopes(cred.credential)
        return NextResponse.json({ scopes })
      } catch (err) {
        return serverError(err, cred.provider)
      }
    }
  }

  // Fallback: legacy Google-only path
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const oauth2Client = new OAuth2Client(token.client_id, token.client_secret)
    oauth2Client.setCredentials({
      access_token: token.token,
      refresh_token: token.refresh_token,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    const accessToken = credentials.access_token

    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    )

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch token info" }, { status: 502 })
    }

    const info = await res.json()
    const scopeString: string = info.scope || ""
    const scopes = scopeString.split(" ").filter(Boolean)

    return NextResponse.json({ scopes })
  } catch (err) {
    return serverError(err)
  }
}
