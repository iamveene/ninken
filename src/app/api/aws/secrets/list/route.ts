import { NextResponse } from "next/server"
import {
  SecretsManagerClient,
  ListSecretsCommand,
  type SecretListEntry,
} from "@aws-sdk/client-secrets-manager"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/secrets/list?region=Z
 * Lists all secrets in Secrets Manager.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined

  try {
    const sm = createAwsClient(credential, SecretsManagerClient, region)

    const secrets = await awsPaginateAll(
      (nextToken) =>
        sm.send(new ListSecretsCommand({ NextToken: nextToken, MaxResults: 100 })),
      (res) => res.SecretList as SecretListEntry[],
      (res) => res.NextToken,
      10,
    )

    const mapped = secrets.map((s) => ({
      name: s.Name ?? "",
      arn: s.ARN ?? "",
      description: s.Description ?? null,
      lastChangedDate: s.LastChangedDate?.toISOString() ?? null,
      lastRotatedDate: s.LastRotatedDate?.toISOString() ?? null,
      rotationEnabled: s.RotationEnabled ?? false,
      tags: (s.Tags ?? []).map((t) => ({
        key: t.Key ?? "",
        value: t.Value ?? "",
      })),
    }))

    return NextResponse.json({
      secrets: mapped,
      totalCount: mapped.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
