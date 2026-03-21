import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getAwsCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/s3/download?bucket=X&key=Y&region=Z
 * Streams an S3 object as a download.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get("bucket")
  const key = searchParams.get("key")
  const region = searchParams.get("region") || undefined

  if (!bucket || !key) return badRequest("Missing required parameters: bucket, key")

  try {
    const s3 = createAwsClient(credential, S3Client, region)
    const result = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    if (!result.Body) {
      return badRequest("Empty response body from S3")
    }

    const filename = key.split("/").pop() || "download"
    const contentType = result.ContentType || "application/octet-stream"

    // Convert the SDK stream to a web ReadableStream
    const webStream = result.Body.transformToWebStream()

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...(result.ContentLength ? { "Content-Length": result.ContentLength.toString() } : {}),
      },
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
