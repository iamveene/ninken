import { NextResponse } from "next/server"
import { S3Client, GetBucketPolicyCommand } from "@aws-sdk/client-s3"
import { getAwsCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/s3/policy?bucket=X&region=Z
 * Returns the bucket policy JSON for an S3 bucket.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get("bucket")
  const region = searchParams.get("region") || undefined

  if (!bucket) return badRequest("Missing required parameter: bucket")

  try {
    const s3 = createAwsClient(credential, S3Client, region)
    const result = await s3.send(new GetBucketPolicyCommand({
      Bucket: bucket,
    }))

    const policy = result.Policy ? JSON.parse(result.Policy) : null

    return NextResponse.json({ policy })
  } catch (error) {
    // NoSuchBucketPolicy is not really an error — the bucket just has no policy
    const err = error as { name?: string }
    if (err.name === "NoSuchBucketPolicy") {
      return NextResponse.json({ policy: null })
    }
    return serverError(error, "aws")
  }
}
