import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

// BUG-13: Scope gap — Teams Web Graph tokens include ChatMember.Read and
// ChatMessage.Send but NOT Chat.Read, which is required by the /me/chats
// endpoint. This means this route will return 403 for browser-extracted tokens.
// The fix requires multi-resource token extraction (roadmap item) to obtain a
// Graph token with the Chat.Read scope. No code change can resolve this today.

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
