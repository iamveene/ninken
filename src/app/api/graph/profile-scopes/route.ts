import { NextRequest, NextResponse } from "next/server"
import type { ProviderId, BaseCredential } from "@/lib/providers/types"
import { getProvider } from "@/lib/providers/registry"
import "@/lib/providers"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, credential } = body as {
      provider: ProviderId
      credential: BaseCredential
    }

    if (!provider || !credential) {
      return NextResponse.json(
        { error: "Missing provider or credential" },
        { status: 400 }
      )
    }

    const providerConfig = getProvider(provider)
    if (!providerConfig) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      )
    }

    const scopes = await providerConfig.fetchScopes(credential)

    // Also return nav items and scope map so client can determine service access
    const services = providerConfig.operateNavItems.map((item) => {
      const requiredScopes = providerConfig.scopeAppMap[item.id] ?? []
      const grantedScopes = requiredScopes.filter((s) => scopes.includes(s))
      return {
        serviceId: item.id,
        serviceName: item.title,
        iconName: item.iconName,
        href: item.href,
        active: grantedScopes.length > 0,
        scopeCount: grantedScopes.length,
        grantedScopes,
        allScopes: requiredScopes,
      }
    })

    return NextResponse.json({ scopes, services })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scope fetch failed" },
      { status: 500 }
    )
  }
}
