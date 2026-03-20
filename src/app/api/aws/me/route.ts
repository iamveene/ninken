import { NextResponse } from "next/server"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { awsIdentity, resolveRegion } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/me
 * Returns the authenticated AWS identity via STS GetCallerIdentity.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const identity = await awsIdentity(credential)
    return NextResponse.json({
      accountId: identity.accountId,
      arn: identity.arn,
      userId: identity.userId,
      region: resolveRegion(credential),
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
