import { NextResponse } from "next/server"
import { IAMClient, ListRolesCommand, type Role } from "@aws-sdk/client-iam"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/iam/roles
 * Lists all IAM roles in the account.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const iam = createAwsClient(credential, IAMClient)

    const roles = await awsPaginateAll(
      (marker) => iam.send(new ListRolesCommand({ Marker: marker, MaxItems: 100 })),
      (res) => res.Roles as Role[],
      (res) => res.Marker,
      10,
    )

    const mapped = roles.map((role) => ({
      roleName: role.RoleName ?? "",
      roleId: role.RoleId ?? "",
      arn: role.Arn ?? "",
      createDate: role.CreateDate?.toISOString() ?? "",
      description: role.Description ?? null,
      maxSessionDuration: role.MaxSessionDuration ?? 3600,
      assumeRolePolicyDocument: role.AssumeRolePolicyDocument
        ? decodeURIComponent(role.AssumeRolePolicyDocument)
        : null,
    }))

    return NextResponse.json({
      roles: mapped,
      totalCount: mapped.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
