import { NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import { analyzeBucketIam } from "@/lib/gcp-audit"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/audit/buckets
 * Fetches all GCS buckets and their IAM policies, then analyzes for public access.
 */
export async function GET() {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = credential.project_id
  if (!project) return badRequest("Project ID required for bucket audit")

  try {
    // 1. List all buckets
    const bucketsData = await gcpKeyFetch<{ items?: { name: string }[] }>({
      credential,
      url: "https://storage.googleapis.com/storage/v1/b",
      params: { project },
    })

    const bucketList = bucketsData.items ?? []

    // 2. For each bucket, fetch IAM policy
    const bucketsWithIam = await Promise.all(
      bucketList.map(async (bucket) => {
        try {
          const iam = await gcpKeyFetch<{
            bindings?: { role: string; members: string[] }[]
          }>({
            credential,
            url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket.name)}/iam`,
          })

          return {
            name: bucket.name,
            iamBindings: iam.bindings ?? [],
          }
        } catch {
          // If we can't read IAM for a specific bucket, skip it
          return {
            name: bucket.name,
            iamBindings: [],
          }
        }
      }),
    )

    // 3. Analyze for public access
    const results = analyzeBucketIam(bucketsWithIam)

    return NextResponse.json({
      buckets: bucketsWithIam,
      results,
      totalCount: results.length,
      publicCount: results.filter((r) => r.isPublic).length,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
