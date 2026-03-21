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
 * Returns true if the API responds (even with empty data or 400).
 * Returns false if 403 (not enabled) or 401 (bad key).
 */
export async function probeGcpApi(url: string, apiKey: string): Promise<boolean> {
  try {
    const u = new URL(url)
    u.searchParams.set("key", apiKey)
    const res = await fetch(u.toString(), { method: "GET" })
    // 200 or 400 (bad request but key accepted) = API is enabled
    // 403 = API not enabled or key restricted
    // 401 = key invalid
    return res.status < 400 || res.status === 400
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
