import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type CrossTenantAccessPolicyResponse = {
  inboundTrust?: {
    isMfaAccepted?: boolean
    isCompliantDeviceAccepted?: boolean
    isHybridAzureADJoinedDeviceAccepted?: boolean
  }
  b2bCollaborationInbound?: Record<string, unknown>
  b2bCollaborationOutbound?: Record<string, unknown>
  b2bDirectConnectInbound?: Record<string, unknown>
  b2bDirectConnectOutbound?: Record<string, unknown>
}

type PartnerResponse = {
  tenantId: string
  inboundTrust?: {
    isMfaAccepted?: boolean
    isCompliantDeviceAccepted?: boolean
    isHybridAzureADJoinedDeviceAccepted?: boolean
  }
  b2bCollaborationInbound?: Record<string, unknown>
  b2bCollaborationOutbound?: Record<string, unknown>
  b2bDirectConnectInbound?: Record<string, unknown>
  b2bDirectConnectOutbound?: Record<string, unknown>
  isServiceProvider?: boolean
  isInMultiTenantOrganization?: boolean
}

type PartnersListResponse = {
  value: PartnerResponse[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const [defaultPolicy, partnersResult] = await Promise.all([
      graphJson<CrossTenantAccessPolicyResponse>(
        credential,
        "/policies/crossTenantAccessPolicy"
      ),
      graphJson<PartnersListResponse>(
        credential,
        "/policies/crossTenantAccessPolicy/partners"
      ),
    ])

    return NextResponse.json({
      defaultPolicy,
      partners: partnersResult.value ?? [],
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
