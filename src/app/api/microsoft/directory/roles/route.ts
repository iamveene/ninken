import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

type DirectoryRole = {
  id: string
  displayName: string
  description?: string
}

type DirectoryMember = {
  id: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

type RolesResponse = {
  value: DirectoryRole[]
}

type MembersResponse = {
  value: DirectoryMember[]
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    // Fetch all activated directory roles
    const rolesData = await graphJson<RolesResponse>(
      credential,
      "/directoryRoles?$select=id,displayName,description"
    )

    const roles = rolesData.value || []

    // Fetch members for each role in parallel
    const rolesWithMembers = await Promise.all(
      roles.map(async (role) => {
        try {
          const membersData = await graphJson<MembersResponse>(
            credential,
            `/directoryRoles/${role.id}/members?$select=id,displayName,mail,userPrincipalName`
          )
          return {
            ...role,
            members: membersData.value || [],
          }
        } catch {
          // If we can't read members for a role, return empty array
          return {
            ...role,
            members: [],
          }
        }
      })
    )

    return NextResponse.json({ roles: rolesWithMembers })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
