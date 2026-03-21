import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type ChatsResponse = {
  value?: Array<{
    id: string
    topic: string | null
    chatType: string
    lastUpdatedDateTime: string | null
  }>
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const data = await graphJson<ChatsResponse>(
      credential,
      "/me/chats?$top=25&$select=id,topic,chatType,lastUpdatedDateTime&$orderby=lastUpdatedDateTime desc"
    )

    return NextResponse.json({ chats: data.value || [] })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
