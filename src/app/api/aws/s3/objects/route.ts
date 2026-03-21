import { NextResponse } from "next/server"
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getAwsCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/s3/objects?bucket=X&prefix=Y&region=Z
 * Lists objects in an S3 bucket with optional prefix filtering.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get("bucket")
  const prefix = searchParams.get("prefix") || undefined
  const region = searchParams.get("region") || undefined

  if (!bucket) return badRequest("Missing required parameter: bucket")

  try {
    const s3 = createAwsClient(credential, S3Client, region)
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: 1000,
    }))

    const objects = (result.Contents ?? []).map((obj) => ({
      key: obj.Key ?? "",
      lastModified: obj.LastModified?.toISOString() ?? null,
      size: obj.Size ?? 0,
      storageClass: obj.StorageClass ?? null,
      isPrefix: false,
    }))

    const prefixes = (result.CommonPrefixes ?? []).map((p) => p.Prefix ?? "")

    return NextResponse.json({
      objects,
      prefixes,
      totalCount: objects.length + prefixes.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
