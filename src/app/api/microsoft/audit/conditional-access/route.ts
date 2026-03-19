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

type GraphListResponse = {
  value: ConditionalAccessPolicy[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    // Conditional access policies endpoint does not support $orderby or pagination via @odata.nextLink
    // in the same way as other endpoints, so we use graphJson directly.
    const result = await graphJson<GraphListResponse>(
      credential,
      "/identity/conditionalAccess/policies"
    )

    return NextResponse.json({
      policies: result.value || [],
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
