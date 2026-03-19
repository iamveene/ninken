import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated, graphFetch, getAccessToken } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get("folder") || null
    const top = Math.min(Number(searchParams.get("top")) || 50, 200)
    const orderby = searchParams.get("orderby") || "lastModifiedDateTime desc"
    const pageToken = searchParams.get("pageToken") || undefined

    const path = folder
      ? `/me/drive/items/${folder}/children`
      : "/me/drive/root/children"

    const result = await graphPaginated(credential, path, {
      top,
      select:
        "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference",
      orderby,
      pageToken,
    })

    return NextResponse.json({
      files: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function POST(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const filename =
      (formData.get("name") as string) || file?.name || "upload"
    const parent = (formData.get("parent") as string) || "root"

    if (!file) {
      return NextResponse.json(
        { error: "Missing required field: file" },
        { status: 400 }
      )
    }

    const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB simple upload limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 4MB simple upload limit" },
        { status: 400 }
      )
    }

    const accessToken = await getAccessToken(credential)
    const arrayBuffer = await file.arrayBuffer()

    const uploadPath =
      parent === "root"
        ? `/me/drive/root:/${encodeURIComponent(filename)}:/content`
        : `/me/drive/items/${parent}:/${encodeURIComponent(filename)}:/content`

    const res = await graphFetch(credential, uploadPath, {
      method: "PUT",
      body: Buffer.from(arrayBuffer),
      extraHeaders: {
        "Content-Type": file.type || "application/octet-stream",
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const message =
        (body as { error?: { message?: string } })?.error?.message ||
        `Upload failed: ${res.status}`
      return NextResponse.json({ error: message }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
