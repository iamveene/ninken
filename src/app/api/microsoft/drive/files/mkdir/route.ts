import { NextResponse } from "next/server"
import {
  getMicrosoftCredential,
  unauthorized,
  badRequest,
  serverError,
} from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export async function POST(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const body = await request.json()
    const { name, parentId } = body as { name?: string; parentId?: string }

    if (!name) {
      return badRequest("Missing required field: name")
    }

    const parent = parentId || "root"
    const path =
      parent === "root"
        ? "/me/drive/root/children"
        : `/me/drive/items/${parent}/children`

    const data = await graphJson(credential, path, {
      method: "POST",
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    })

    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
