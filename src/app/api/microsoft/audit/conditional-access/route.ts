import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type ConditionalAccessPolicy = {
  id: string
  displayName: string
  state: string
  createdDateTime: string
  modifiedDateTime: string
  conditions: Record<string, unknown>
  grantControls: Record<string, unknown> | null
  sessionControls: Record<string, unknown> | null
}

type NamedLocation = {
  id: string
  displayName: string
  isTrusted?: boolean
}

type GraphListResponse<T> = {
  value: T[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const [policiesResult, namedLocationsResult] = await Promise.all([
      graphJson<GraphListResponse<ConditionalAccessPolicy>>(
        credential,
        "/identity/conditionalAccess/policies"
      ),
      graphJson<GraphListResponse<NamedLocation>>(
        credential,
        "/identity/conditionalAccess/namedLocations"
      ).catch(() => ({ value: [] as NamedLocation[] })),
    ])

    return NextResponse.json({
      policies: policiesResult.value || [],
      namedLocations: namedLocationsResult.value || [],
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
