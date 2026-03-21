import { NextResponse } from "next/server"
import { EC2Client, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/ec2/security-groups?region=X
 * Describes all security groups in the specified region.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined

  try {
    const ec2 = createAwsClient(credential, EC2Client, region)

    const allGroups: {
      groupId: string
      groupName: string
      description: string | null
      vpcId: string | null
      inboundRules: { protocol: string; fromPort: number | null; toPort: number | null; source: string }[]
      outboundRules: { protocol: string; fromPort: number | null; toPort: number | null; destination: string }[]
    }[] = []

    let nextToken: string | undefined

    do {
      const result = await ec2.send(
        new DescribeSecurityGroupsCommand({ NextToken: nextToken, MaxResults: 100 })
      )

      for (const sg of result.SecurityGroups ?? []) {
        allGroups.push({
          groupId: sg.GroupId ?? "",
          groupName: sg.GroupName ?? "",
          description: sg.Description ?? null,
          vpcId: sg.VpcId ?? null,
          inboundRules: (sg.IpPermissions ?? []).flatMap((perm) => {
            const protocol = perm.IpProtocol ?? "-1"
            const fromPort = perm.FromPort ?? null
            const toPort = perm.ToPort ?? null
            const sources: string[] = [
              ...(perm.IpRanges ?? []).map((r) => r.CidrIp ?? ""),
              ...(perm.Ipv6Ranges ?? []).map((r) => r.CidrIpv6 ?? ""),
              ...(perm.UserIdGroupPairs ?? []).map((g) => g.GroupId ?? ""),
            ]
            return sources.map((source) => ({ protocol, fromPort, toPort, source }))
          }),
          outboundRules: (sg.IpPermissionsEgress ?? []).flatMap((perm) => {
            const protocol = perm.IpProtocol ?? "-1"
            const fromPort = perm.FromPort ?? null
            const toPort = perm.ToPort ?? null
            const destinations: string[] = [
              ...(perm.IpRanges ?? []).map((r) => r.CidrIp ?? ""),
              ...(perm.Ipv6Ranges ?? []).map((r) => r.CidrIpv6 ?? ""),
              ...(perm.UserIdGroupPairs ?? []).map((g) => g.GroupId ?? ""),
            ]
            return destinations.map((destination) => ({ protocol, fromPort, toPort, destination }))
          }),
        })
      }

      nextToken = result.NextToken
    } while (nextToken)

    return NextResponse.json({
      securityGroups: allGroups,
      totalCount: allGroups.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
