import { NextResponse } from "next/server"
import { getCredentialFromRequest, badRequest, unauthorized } from "@/app/api/_helpers"

export const dynamic = "force-dynamic"

interface ProxyRequestBody {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

/**
 * POST /api/studio/proxy
 * Server-side CORS proxy for the API Explorer.
 * Forwards arbitrary HTTP requests so the browser avoids CORS restrictions.
 *
 * Body: { url, method, headers?, body? }
 * Returns: { status, statusText, headers, body, timeMs }
 */
export async function POST(request: Request) {
  // Auth gate: any valid session
  const credential = await getCredentialFromRequest()
  if (!credential) {
    return unauthorized()
  }

  let payload: ProxyRequestBody
  try {
    payload = await request.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const { url, method, headers: reqHeaders, body: reqBody } = payload

  if (!url || typeof url !== "string") {
    return badRequest("Missing or invalid 'url' field")
  }

  if (!method || typeof method !== "string") {
    return badRequest("Missing or invalid 'method' field")
  }

  const upperMethod = method.toUpperCase()
  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
  if (!allowedMethods.includes(upperMethod)) {
    return badRequest(`Unsupported method '${method}'. Allowed: ${allowedMethods.join(", ")}`)
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    return badRequest("Invalid URL format")
  }

  const fetchOptions: RequestInit = {
    method: upperMethod,
    headers: reqHeaders ?? {},
  }

  // Only attach body for methods that support it
  if (reqBody && !["GET", "HEAD"].includes(upperMethod)) {
    fetchOptions.body = reqBody
  }

  const start = performance.now()

  try {
    const response = await fetch(url, fetchOptions)
    const timeMs = Math.round(performance.now() - start)

    // Collect response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // Read body as text
    const responseBody = await response.text()

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      timeMs,
    })
  } catch (error) {
    const timeMs = Math.round(performance.now() - start)
    const message = error instanceof Error ? error.message : "Proxy request failed"
    return NextResponse.json(
      {
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: message,
        timeMs,
      },
      { status: 502 }
    )
  }
}
