import { NextResponse } from "next/server"
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager"
import { getAwsCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/secrets/value?secretId=X&region=Z
 * Retrieves the value of a specific secret.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const secretId = searchParams.get("secretId")
  const region = searchParams.get("region") || undefined

  if (!secretId) return badRequest("Missing required parameter: secretId")

  try {
    const sm = createAwsClient(credential, SecretsManagerClient, region)
    const result = await sm.send(
      new GetSecretValueCommand({ SecretId: secretId })
    )

    return NextResponse.json({
      name: result.Name ?? "",
      arn: result.ARN ?? "",
      secretString: result.SecretString ?? null,
      secretBinary: result.SecretBinary ? "[binary data]" : null,
      versionId: result.VersionId ?? null,
      createdDate: result.CreatedDate?.toISOString() ?? null,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
