import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type GraphUser = {
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const user = await graphJson<GraphUser>(
      credential,
      "/me?$select=displayName,mail,userPrincipalName"
    )

    return NextResponse.json({
      displayName: user.displayName || "",
      mail: user.mail || user.userPrincipalName || "",
      userPrincipalName: user.userPrincipalName || "",
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
