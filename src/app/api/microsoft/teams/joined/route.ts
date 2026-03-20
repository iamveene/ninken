import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type JoinedTeamsResponse = {
  value?: Array<{
    id: string
    displayName: string
    description: string | null
  }>
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const data = await graphJson<JoinedTeamsResponse>(
      credential,
      "/me/joinedTeams?$select=id,displayName,description"
    )

    return NextResponse.json({ teams: data.value || [] })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
