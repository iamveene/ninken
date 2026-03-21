import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type MailFolder = {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

type MailFolderListResponse = {
  value: MailFolder[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const result = await graphJson<MailFolderListResponse>(
      credential,
      "/me/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount"
    )

    return NextResponse.json({ folders: result.value || [] })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
