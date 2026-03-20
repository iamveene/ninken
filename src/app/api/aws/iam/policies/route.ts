import { NextResponse } from "next/server"
import { IAMClient, ListPoliciesCommand, type Policy } from "@aws-sdk/client-iam"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/iam/policies
 * Lists customer-managed IAM policies.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const iam = createAwsClient(credential, IAMClient)

    const policies = await awsPaginateAll(
      (marker) =>
        iam.send(
          new ListPoliciesCommand({
            Marker: marker,
            MaxItems: 100,
            Scope: "Local", // Customer-managed only
          })
        ),
      (res) => res.Policies as Policy[],
      (res) => res.Marker,
      10,
    )

    const mapped = policies.map((policy) => ({
      policyName: policy.PolicyName ?? "",
      policyId: policy.PolicyId ?? "",
      arn: policy.Arn ?? "",
      createDate: policy.CreateDate?.toISOString() ?? "",
      updateDate: policy.UpdateDate?.toISOString() ?? "",
      attachmentCount: policy.AttachmentCount ?? 0,
      isAttachable: policy.IsAttachable ?? false,
      description: policy.Description ?? null,
    }))

    return NextResponse.json({
      policies: mapped,
      totalCount: mapped.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
