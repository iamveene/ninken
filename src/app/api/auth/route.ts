import { NextResponse } from "next/server"
import {
  AUTH_COOKIE_NAME,
  ACTIVE_PROFILE_COOKIE,
  validateTokenData,
  getProfilesFromCookies,
  getActiveProfileIndex,
  type ProfileData,
} from "@/lib/auth"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

function setProfilesCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  profiles: ProfileData[],
  activeIndex: number
) {
  if (profiles.length === 0) {
    cookieStore.delete(AUTH_COOKIE_NAME)
    cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    return
  }
  cookieStore.set(AUTH_COOKIE_NAME, JSON.stringify(profiles), COOKIE_OPTS)
  cookieStore.set(ACTIVE_PROFILE_COOKIE, String(activeIndex), COOKIE_OPTS)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = validateTokenData(body)
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const cookieStore = await cookies()
  const profiles = getProfilesFromCookies(cookieStore)

  // Include email if provided in body
  const newProfile: ProfileData = {
    ...result.token,
    email: typeof (body as Record<string, unknown>).email === "string"
      ? (body as Record<string, unknown>).email as string
      : undefined,
  }

  profiles.push(newProfile)
  const newIndex = profiles.length - 1
  setProfilesCookie(cookieStore, profiles, newIndex)

  return NextResponse.json({
    authenticated: true,
    activeProfile: newIndex,
    profileCount: profiles.length,
  })
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const profiles = getProfilesFromCookies(cookieStore)

  // Switch active profile
  if (typeof body.activeProfile === "number") {
    const idx = body.activeProfile
    if (idx < 0 || idx >= profiles.length) {
      return NextResponse.json({ error: "Invalid profile index" }, { status: 400 })
    }
    setProfilesCookie(cookieStore, profiles, idx)
    return NextResponse.json({ activeProfile: idx })
  }

  // Update email for a profile
  if (typeof body.index === "number" && typeof body.email === "string") {
    const idx = body.index
    if (idx < 0 || idx >= profiles.length) {
      return NextResponse.json({ error: "Invalid profile index" }, { status: 400 })
    }
    profiles[idx] = { ...profiles[idx], email: body.email }
    const activeIndex = getActiveProfileIndex(cookieStore)
    setProfilesCookie(cookieStore, profiles, activeIndex)
    return NextResponse.json({ updated: true })
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

export async function DELETE() {
  const cookieStore = await cookies()

  // Clear both legacy and new cookies
  cookieStore.delete(AUTH_COOKIE_NAME)
  cookieStore.delete(ACTIVE_PROFILE_COOKIE)
  cookieStore.delete("ninken_token")
  cookieStore.delete("ninken_provider")

  return NextResponse.json({ authenticated: false })
}

export async function GET() {
  const cookieStore = await cookies()

  // Check new cookie format first
  const newCookie = cookieStore.get("ninken_token")
  if (newCookie?.value) {
    try {
      const parsed = JSON.parse(newCookie.value)
      const providerCookie = cookieStore.get("ninken_provider")
      return NextResponse.json({
        authenticated: true,
        provider: providerCookie?.value ?? parsed.provider ?? "google",
        // Profile info comes from IndexedDB on client side
        // Server only confirms auth state
        profiles: [],
        activeProfile: 0,
        format: "v2",
      })
    } catch {
      // Malformed — fall through
    }
  }

  // Legacy format
  const profiles = getProfilesFromCookies(cookieStore)
  const activeProfile = getActiveProfileIndex(cookieStore)

  return NextResponse.json({
    authenticated: profiles.length > 0,
    profiles: profiles.map((p, i) => ({
      email: p.email || null,
      index: i,
    })),
    activeProfile: profiles.length > 0 ? Math.min(activeProfile, profiles.length - 1) : 0,
    format: "v1",
  })
}
