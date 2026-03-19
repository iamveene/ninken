import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  AUTH_COOKIE_NAME,
  ACTIVE_PROFILE_COOKIE,
  getProfilesFromCookies,
} from "@/lib/auth"
import { serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

/**
 * GET: Export legacy cookie-based profiles for one-time migration to IndexedDB.
 * Returns full credential data. Only responds if legacy cookies exist.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const legacyCookie = cookieStore.get(AUTH_COOKIE_NAME)

    if (!legacyCookie?.value) {
      return NextResponse.json(
        { error: "No legacy profiles found" },
        { status: 404 }
      )
    }

    const profiles = getProfilesFromCookies(cookieStore)
    if (profiles.length === 0) {
      return NextResponse.json(
        { error: "No legacy profiles found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ profiles })
  } catch (error) {
    return serverError(error)
  }
}

/**
 * DELETE: Clear legacy cookies after migration is complete.
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(AUTH_COOKIE_NAME)
    cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    return NextResponse.json({ cleared: true })
  } catch (error) {
    return serverError(error)
  }
}
