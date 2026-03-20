import { NextResponse } from "next/server"
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/s3/buckets
 * Lists all S3 buckets in the account.
 */
export async function GET() {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  try {
    const s3 = createAwsClient(credential, S3Client)
    const result = await s3.send(new ListBucketsCommand({}))

    const buckets = (result.Buckets ?? []).map((b) => ({
      name: b.Name ?? "unknown",
      creationDate: b.CreationDate?.toISOString() ?? null,
    }))

    return NextResponse.json({
      buckets,
      totalCount: buckets.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
