import { NextResponse } from "next/server"
import { getCredentialFromRequest, unauthorized, serverError } from "@/app/api/_helpers"
import { getProvider } from "@/lib/providers/registry"

export const dynamic = "force-dynamic"

export async function GET() {
  const cred = await getCredentialFromRequest()
  if (!cred) return unauthorized()

  const provider = getProvider(cred.provider)
  if (!provider) return unauthorized()

  try {
    const scopes = await provider.fetchScopes(cred.credential)
    return NextResponse.json({ scopes })
  } catch (err) {
    return serverError(err, cred.provider)
  }
}
