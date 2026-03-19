import { NextResponse } from "next/server"
import { createPeopleServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPerson(
  person: any,
  source: "directory" | "contacts" | "other"
) {
  const names = person.names ?? []
  const displayName =
    names[0]?.displayName ?? names[0]?.unstructuredName ?? ""

  const emails = (person.emailAddresses ?? []).map(
    (e: any) => e.value as string
  )

  const phones = (person.phoneNumbers ?? []).map(
    (p: any) => p.value as string
  )

  const org = person.organizations?.[0]
  const organization = org
    ? {
        name: org.name ?? "",
        title: org.title ?? "",
        department: org.department ?? "",
      }
    : null

  return {
    resourceName: person.resourceName ?? "",
    displayName,
    emails,
    phones,
    organization,
    source,
    photoUrl: person.photos?.[0]?.url ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function getErrorCode(err: unknown): number {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code: number }).code
  }
  return 0
}

/** Fetch from a source, returning denied-scope response on 403. */
async function fetchSource(
  fetcher: () => Promise<{ people: unknown[]; nextPageToken?: string | null; totalItems?: number | null }>,
  source: "directory" | "contacts" | "other",
  scope: "organization" | "user"
) {
  try {
    const { people, nextPageToken, totalItems } = await fetcher()
    const contacts = people.map((p) => mapPerson(p, source))
    return NextResponse.json({
      contacts,
      nextPageToken: nextPageToken ?? null,
      source,
      scope,
      ...(totalItems != null ? { totalItems } : {}),
    })
  } catch (err) {
    if (getErrorCode(err) === 403) {
      return NextResponse.json({
        contacts: [],
        nextPageToken: null,
        source,
        scope: "denied",
      })
    }
    throw err
  }
}

/**
 * GET /api/audit/contacts?source={directory|contacts|other}&pageSize=100&pageToken=
 *
 * Lists contacts from three possible sources.
 * Graceful degradation: 403 on one source does not block others.
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get("source") || "directory"
    const pageSize = Math.min(
      Number(searchParams.get("pageSize")) || 100,
      1000
    )
    const pageToken = searchParams.get("pageToken") || undefined

    const people = createPeopleServiceFromToken(accessToken)

    if (source === "directory") {
      return fetchSource(async () => {
        const res = await people.people.listDirectoryPeople({
          sources: ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"],
          readMask: "names,emailAddresses,phoneNumbers,organizations,photos,metadata",
          pageSize,
          pageToken,
        })
        return { people: res.data.people ?? [], nextPageToken: res.data.nextPageToken }
      }, "directory", "organization")
    }

    if (source === "contacts") {
      return fetchSource(async () => {
        const res = await people.people.connections.list({
          resourceName: "people/me",
          personFields: "names,emailAddresses,phoneNumbers,organizations,addresses,relations,metadata",
          pageSize,
          pageToken,
        })
        return {
          people: res.data.connections ?? [],
          nextPageToken: res.data.nextPageToken,
          totalItems: res.data.totalItems,
        }
      }, "contacts", "user")
    }

    if (source === "other") {
      return fetchSource(async () => {
        const res = await people.otherContacts.list({
          readMask: "names,emailAddresses,phoneNumbers",
          pageSize,
          pageToken,
        })
        return { people: res.data.otherContacts ?? [], nextPageToken: res.data.nextPageToken }
      }, "other", "user")
    }

    return badRequest("Invalid source parameter. Expected: directory, contacts, or other")
  } catch (error) {
    return serverError(error, "google")
  }
}
