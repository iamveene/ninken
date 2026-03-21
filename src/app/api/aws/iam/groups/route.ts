import { NextResponse } from "next/server"
import { IAMClient, ListGroupsCommand, type Group } from "@aws-sdk/client-iam"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/iam/groups
 * Lists all IAM groups in the account.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const iam = createAwsClient(credential, IAMClient)

    const groups = await awsPaginateAll(
      (marker) => iam.send(new ListGroupsCommand({ Marker: marker, MaxItems: 100 })),
      (res) => res.Groups as Group[],
      (res) => res.Marker,
      10,
    )

    const mapped = groups.map((group) => ({
      groupName: group.GroupName ?? "",
      groupId: group.GroupId ?? "",
      arn: group.Arn ?? "",
      createDate: group.CreateDate?.toISOString() ?? "",
    }))

    return NextResponse.json({
      groups: mapped,
      totalCount: mapped.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
