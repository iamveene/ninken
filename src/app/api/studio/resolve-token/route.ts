import { NextResponse } from "next/server"
import { getCredentialFromRequest, unauthorized } from "@/app/api/_helpers"
import { getProvider } from "@/lib/providers/registry"
import "@/lib/providers"

export const dynamic = "force-dynamic"

export async function POST() {
  const cred = await getCredentialFromRequest()
  if (!cred) return unauthorized()

  const provider = getProvider(cred.provider)
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${cred.provider}` }, { status: 400 })
  }

  try {
    const accessToken = await provider.getAccessToken(cred.credential)
    return NextResponse.json({
      token: accessToken,
      tokenType: "bearer",
      provider: cred.provider,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token resolution failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
