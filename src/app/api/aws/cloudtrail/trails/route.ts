import { NextResponse } from "next/server"
import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from "@aws-sdk/client-cloudtrail"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/cloudtrail/trails?region=X
 * Describes all CloudTrail trails.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined

  try {
    const ct = createAwsClient(credential, CloudTrailClient, region)
    const result = await ct.send(new DescribeTrailsCommand({}))

    const trails = await Promise.all(
      (result.trailList ?? []).map(async (trail) => {
        let isLogging: boolean | null = null
        try {
          const status = await ct.send(
            new GetTrailStatusCommand({ Name: trail.TrailARN })
          )
          isLogging = status.IsLogging ?? null
        } catch {
          // May not have permission to check status
        }

        return {
          name: trail.Name ?? "",
          s3BucketName: trail.S3BucketName ?? null,
          isMultiRegionTrail: trail.IsMultiRegionTrail ?? false,
          homeRegion: trail.HomeRegion ?? null,
          isLogging,
        }
      })
    )

    return NextResponse.json({
      trails,
      totalCount: trails.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
