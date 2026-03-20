import { NextResponse } from "next/server"
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts"
import { getAwsCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * POST /api/aws/sts/assume-role
 * Body: { roleArn: string, sessionName?: string }
 * Returns temporary credentials from STS AssumeRole.
 */
export async function POST(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const body = await request.json()
    const roleArn = body.roleArn as string | undefined
    const sessionName = (body.sessionName as string | undefined) ?? "ninken-session"

    if (!roleArn) return badRequest("Missing required field: roleArn")

    const sts = createAwsClient(credential, STSClient)
    const result = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: 3600,
      })
    )

    if (!result.Credentials) {
      return badRequest("No credentials returned from AssumeRole")
    }

    return NextResponse.json({
      accessKeyId: result.Credentials.AccessKeyId ?? "",
      secretAccessKey: result.Credentials.SecretAccessKey ?? "",
      sessionToken: result.Credentials.SessionToken ?? "",
      expiration: result.Credentials.Expiration?.toISOString() ?? null,
      assumedRoleArn: result.AssumedRoleUser?.Arn ?? null,
      assumedRoleId: result.AssumedRoleUser?.AssumedRoleId ?? null,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
