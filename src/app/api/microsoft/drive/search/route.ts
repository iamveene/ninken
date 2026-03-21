import { NextResponse } from "next/server"
import {
  getMicrosoftCredential,
  unauthorized,
  badRequest,
  serverError,
} from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"
import { sanitizeODataValue } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type SearchResult = {
  value?: unknown[]
  "@odata.nextLink"?: string
}

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get("term")

    if (!term) {
      return badRequest("Missing required query parameter: term")
    }

    const sanitized = sanitizeODataValue(term)
    const data = await graphJson<SearchResult>(
      credential,
      `/me/drive/root/search(q='${sanitized}')?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference&$top=50`
    )

    return NextResponse.json({
      files: data.value || [],
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
