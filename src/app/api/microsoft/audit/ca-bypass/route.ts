import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type ConditionalAccessPolicy = {
  id: string
  displayName: string
  state: string
  conditions: Record<string, unknown>
  grantControls: Record<string, unknown> | null
  sessionControls: Record<string, unknown> | null
}

type NamedLocation = {
  id: string
  displayName: string
  isTrusted?: boolean
}

type SecurityDefaultsPolicy = {
  isEnabled?: boolean
}

type GraphListResponse<T> = {
  value: T[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const [policiesResult, namedLocationsResult, securityDefaultsResult] = await Promise.all([
      graphJson<GraphListResponse<ConditionalAccessPolicy>>(
        credential,
        "/identity/conditionalAccess/policies",
      ),
      graphJson<GraphListResponse<NamedLocation>>(
        credential,
        "/identity/conditionalAccess/namedLocations",
      ).catch(() => ({ value: [] as NamedLocation[] })),
      graphJson<SecurityDefaultsPolicy>(
        credential,
        "/policies/identitySecurityDefaultsEnforcementPolicy",
      ).catch(() => null),
    ])

    return NextResponse.json({
      policies: policiesResult.value || [],
      namedLocations: namedLocationsResult.value || [],
      securityDefaultsEnabled: securityDefaultsResult?.isEnabled ?? null,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
