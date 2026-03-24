import type { GcpApiKeyCredential } from "@/lib/providers/types"

/**
 * GCP API Key Client Library
 *
 * Google API keys authenticate via query parameter (?key=...),
 * NOT via Authorization header. This library wraps REST calls
 * to GCP APIs using API key auth.
 */

export type GcpKeyFetchOptions = {
  credential: GcpApiKeyCredential
  url: string
  method?: string
  body?: unknown
  params?: Record<string, string>
}

export async function gcpKeyFetch<T>({
  credential,
  url,
  method = "GET",
  body,
  params,
}: GcpKeyFetchOptions): Promise<T> {
  const u = new URL(url)
  u.searchParams.set("key", credential.api_key)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v)
    }
  }

  const res = await fetch(u.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({
      error: { message: res.statusText, code: res.status },
    }))
    const err = errBody?.error ?? errBody
    throw {
      code: err?.code ?? res.status,
      message: err?.message ?? res.statusText,
      status: err?.status,
    }
  }

  return res.json()
}

/**
 * Probe a GCP API to check if it's enabled for the key.
 * Returns true if the API responds with any data or a parseable error.
 * Returns false if the key is rejected outright (403/401 with "API key not valid").
 */
export async function probeGcpApi(url: string, apiKey: string): Promise<boolean> {
  try {
    const u = new URL(url)
    u.searchParams.set("key", apiKey)
    const res = await fetch(u.toString(), { method: "GET" })

    // 200 = works
    if (res.ok) return true

    // Parse the error body to distinguish "API not enabled" from "bad project"
    const body = await res.json().catch(() => null)
    const message = body?.error?.message ?? ""
    const status = body?.error?.status ?? ""

    // Key is valid but project/resource not found — API is enabled
    if (res.status === 404) return true
    // Bad request but key accepted — API is enabled
    if (res.status === 400 && !message.includes("API key not valid")) return true
    // Permission denied with specific API disabled message — API not enabled
    if (status === "PERMISSION_DENIED" && message.includes("has not been used")) return false
    if (status === "PERMISSION_DENIED" && message.includes("is not enabled")) return false
    // Generic 403 — could be key restriction, treat as not available
    if (res.status === 403) return false
    // 401 — key invalid
    if (res.status === 401) return false

    // Unknown error — treat as not available
    return false
  } catch {
    return false
  }
}

export function parseGcpKeyError(
  error: unknown,
): { status: number; message: string } {
  if (!error || typeof error !== "object") {
    return { status: 500, message: "Unknown GCP error" }
  }
  const err = error as { code?: number; message?: string; status?: string }

  if (err.status === "PERMISSION_DENIED") {
    return { status: 403, message: err.message || "API key lacks permission" }
  }
  if (err.status === "NOT_FOUND") {
    return { status: 404, message: err.message || "Resource not found" }
  }
  if (err.code === 400 && err.message?.includes("API key not valid")) {
    return { status: 401, message: "API key is invalid or has been revoked" }
  }

  return {
    status: err.code || 500,
    message: err.message || "GCP API error",
  }
}
