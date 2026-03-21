import { NextResponse } from "next/server"
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/ec2/instances?region=X
 * Describes all EC2 instances in the specified region.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined

  try {
    const ec2 = createAwsClient(credential, EC2Client, region)

    const allInstances: {
      instanceId: string
      instanceType: string
      state: string
      publicIp: string | null
      privateIp: string | null
      launchTime: string | null
      vpcId: string | null
      subnetId: string | null
      name: string | null
      platform: string | null
    }[] = []

    let nextToken: string | undefined

    do {
      const result = await ec2.send(
        new DescribeInstancesCommand({ NextToken: nextToken, MaxResults: 100 })
      )

      for (const reservation of result.Reservations ?? []) {
        for (const inst of reservation.Instances ?? []) {
          const nameTag = inst.Tags?.find((t) => t.Key === "Name")
          allInstances.push({
            instanceId: inst.InstanceId ?? "",
            instanceType: inst.InstanceType ?? "",
            state: inst.State?.Name ?? "unknown",
            publicIp: inst.PublicIpAddress ?? null,
            privateIp: inst.PrivateIpAddress ?? null,
            launchTime: inst.LaunchTime?.toISOString() ?? null,
            vpcId: inst.VpcId ?? null,
            subnetId: inst.SubnetId ?? null,
            name: nameTag?.Value ?? null,
            platform: inst.PlatformDetails ?? null,
          })
        }
      }

      nextToken = result.NextToken
    } while (nextToken)

    return NextResponse.json({
      instances: allInstances,
      totalCount: allInstances.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
