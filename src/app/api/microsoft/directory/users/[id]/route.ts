import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/directory/users/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const data = await graphJson(
      credential,
      `/users/${id}?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones,accountEnabled,createdDateTime,lastSignInDateTime`
    )

    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
