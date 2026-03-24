import { NextResponse } from "next/server"
import { CloudTrailClient, LookupEventsCommand } from "@aws-sdk/client-cloudtrail"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/cloudtrail/events?region=X&startTime=T&endTime=T
 * Looks up recent CloudTrail events.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined
  const startTimeStr = searchParams.get("startTime")
  const endTimeStr = searchParams.get("endTime")

  try {
    const ct = createAwsClient(credential, CloudTrailClient, region)

    const startTime = startTimeStr ? new Date(startTimeStr) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    const endTime = endTimeStr ? new Date(endTimeStr) : new Date()

    const allEvents: {
      eventId: string
      eventName: string
      eventTime: string
      eventSource: string
      username: string | null
      sourceIp: string | null
      resources: { resourceType: string; resourceName: string }[]
      readOnly: boolean | null
    }[] = []

    let nextToken: string | undefined
    let pages = 0

    do {
      const result = await ct.send(
        new LookupEventsCommand({
          StartTime: startTime,
          EndTime: endTime,
          MaxResults: 50,
          NextToken: nextToken,
        })
      )

      for (const event of result.Events ?? []) {
        allEvents.push({
          eventId: event.EventId ?? "",
          eventName: event.EventName ?? "",
          eventTime: event.EventTime?.toISOString() ?? "",
          eventSource: event.EventSource ?? "",
          username: event.Username ?? null,
          sourceIp: event.CloudTrailEvent
            ? (() => {
                try {
                  const parsed = JSON.parse(event.CloudTrailEvent)
                  return parsed.sourceIPAddress ?? null
                } catch {
                  return null
                }
              })()
            : null,
          resources: (event.Resources ?? []).map((r) => ({
            resourceType: r.ResourceType ?? "",
            resourceName: r.ResourceName ?? "",
          })),
          readOnly: event.ReadOnly ? event.ReadOnly === "true" : null,
        })
      }

      nextToken = result.NextToken
      pages++
    } while (nextToken && pages < 5)

    return NextResponse.json({
      events: allEvents,
      totalCount: allEvents.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
