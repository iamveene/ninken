/**
 * Shared crypto/encoding utilities used by multiple credential strategies.
 */

/**
 * Base64url encode a Uint8Array (no padding).
 */
export function base64urlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** Base64url encode a UTF-8 string. */
export function base64url(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str))
}

/** Decode a base64 string (standard or URL-safe) to Uint8Array. */
export function base64Decode(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/")
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized + "=".repeat(4 - (normalized.length % 4))
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}
