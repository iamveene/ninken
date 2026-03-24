import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import {
  getAccessToken,
  decodeScopesFromJwt,
  decodeJwtPayload,
  graphFetch,
} from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const accessToken = await getAccessToken(credential)

    // Decode token info
    const scopes = decodeScopesFromJwt(accessToken)
    const payload = decodeJwtPayload(accessToken)
    const email =
      (payload?.upn as string) ||
      (payload?.unique_name as string) ||
      (payload?.preferred_username as string) ||
      ""
    const tenantId = (payload?.tid as string) || credential.tenant_id
    const exp = payload?.exp as number | undefined
    const expiresIn = exp ? exp - Math.floor(Date.now() / 1000) : 0

    // Parallel probe of accessible services
    const [meResult, outlookResult, driveResult, teamsResult, directoryResult] =
      await Promise.allSettled([
        graphFetch(credential, "/me"),
        graphFetch(credential, "/me/messages?$top=1"),
        graphFetch(credential, "/me/drive/root"),
        graphFetch(credential, "/me/joinedTeams?$top=1"),
        graphFetch(credential, "/users?$top=1"),
      ])

    const isAccessible = (
      result: PromiseSettledResult<Response>
    ): boolean => {
      return result.status === "fulfilled" && result.value.ok
    }

    return NextResponse.json({
      tokenInfo: {
        scopes,
        email,
        tenantId,
        expiresIn,
      },
      me: {
        accessible: isAccessible(meResult),
      },
      outlook: {
        accessible: isAccessible(outlookResult),
      },
      onedrive: {
        accessible: isAccessible(driveResult),
      },
      teams: {
        accessible: isAccessible(teamsResult),
      },
      directory: {
        accessible: isAccessible(directoryResult),
      },
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
