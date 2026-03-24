import { TEAMS_FOCI_CLIENT_ID } from "./microsoft-oauth"

const NATIVE_REDIRECT_URI =
  "https://login.microsoftonline.com/common/oauth2/nativeclient"

/**
 * Perform a silent SSO authorization flow with custom headers/cookies,
 * capture the auth code from the redirect, and exchange it for an access token.
 *
 * Shared by PRT cookie and browser session strategies — the only difference
 * is how the initial authorize request is authenticated (headers vs cookie).
 */
export async function exchangeAuthCodeForToken(opts: {
  tenant: string
  clientId?: string
  /** Extra headers to send on the authorize GET request (e.g. cookie, PRT header) */
  authorizeHeaders: Record<string, string>
  /** Human-readable strategy name for error messages */
  strategyLabel: string
}): Promise<string> {
  const clientId = opts.clientId || TEAMS_FOCI_CLIENT_ID
  const tenant = opts.tenant

  // Step 1: Silent auth to capture authorization code
  const authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  const authParams = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: NATIVE_REDIRECT_URI,
    scope: "https://graph.microsoft.com/.default openid",
    prompt: "none",
    response_mode: "query",
  })

  const authRes = await fetch(`${authorizeUrl}?${authParams.toString()}`, {
    method: "GET",
    headers: opts.authorizeHeaders,
    redirect: "manual",
  })

  // Expect a 302 redirect with the auth code
  const locationHeader = authRes.headers.get("location")
  if (!locationHeader) {
    const body = await authRes
      .text()
      .catch(() => "No redirect received")
    throw new Error(
      `${opts.strategyLabel} failed — expected redirect, got ${authRes.status}: ${body}`,
    )
  }

  const redirectUrl = new URL(locationHeader)
  const code = redirectUrl.searchParams.get("code")
  if (!code) {
    const error = redirectUrl.searchParams.get("error") || "unknown"
    const errorDesc =
      redirectUrl.searchParams.get("error_description") || ""
    throw new Error(
      `${opts.strategyLabel} failed: ${error} — ${errorDesc}`,
    )
  }

  // Step 2: Exchange auth code for access token
  const tokenUri = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
  const tokenRes = await fetch(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: NATIVE_REDIRECT_URI,
      scope: "https://graph.microsoft.com/.default",
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes
      .text()
      .catch(() => "Token exchange failed")
    throw new Error(`${opts.strategyLabel} code exchange failed: ${text}`)
  }

  const data = await tokenRes.json()
  if (!data.access_token) {
    throw new Error(
      `No access_token in ${opts.strategyLabel} code exchange response`,
    )
  }

  return data.access_token as string
}
