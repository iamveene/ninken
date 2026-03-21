import { NextResponse } from "next/server"
import {
  IAMClient,
  ListUsersCommand,
  ListAccessKeysCommand,
  type User,
} from "@aws-sdk/client-iam"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/iam/users
 * Lists all IAM users with their access keys.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const iam = createAwsClient(credential, IAMClient)

    const users = await awsPaginateAll(
      (marker) => iam.send(new ListUsersCommand({ Marker: marker, MaxItems: 100 })),
      (res) => res.Users as User[],
      (res) => res.Marker,
      10,
    )

    // Fetch access keys for each user (limited to first 20 to avoid rate limits)
    const enrichedUsers = await Promise.all(
      users.slice(0, 50).map(async (user) => {
        let accessKeys: { accessKeyId: string; status: string; createDate: string }[] = []
        try {
          const keysResult = await iam.send(
            new ListAccessKeysCommand({ UserName: user.UserName })
          )
          accessKeys = (keysResult.AccessKeyMetadata ?? []).map((k) => ({
            accessKeyId: k.AccessKeyId ?? "",
            status: k.Status ?? "Unknown",
            createDate: k.CreateDate?.toISOString() ?? "",
          }))
        } catch {
          // Access denied to list keys for this user — skip
        }

        return {
          userName: user.UserName ?? "",
          userId: user.UserId ?? "",
          arn: user.Arn ?? "",
          createDate: user.CreateDate?.toISOString() ?? "",
          passwordLastUsed: user.PasswordLastUsed?.toISOString() ?? null,
          accessKeys,
        }
      })
    )

    return NextResponse.json({
      users: enrichedUsers,
      totalCount: users.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
