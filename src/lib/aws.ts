import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts"
import type { AwsCredential } from "@/lib/providers/types"

/**
 * AWS SDK Client Factory for Ninken
 *
 * Generic factory for creating AWS SDK v3 clients with credentials from
 * the Ninken credential store.
 */

// ── Region resolution ─────────────────────────────────────────────────

export function resolveRegion(credential: AwsCredential, override?: string): string {
  return override ?? credential.default_region ?? "us-east-1"
}

// ── Generic client factory ────────────────────────────────────────────

type AwsClientClass<T> = new (config: {
  region: string
  credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}) => T

export function createAwsClient<T>(
  credential: AwsCredential,
  ClientClass: AwsClientClass<T>,
  region?: string,
): T {
  return new ClientClass({
    region: resolveRegion(credential, region),
    credentials: {
      accessKeyId: credential.access_key_id,
      secretAccessKey: credential.secret_access_key,
      sessionToken: credential.session_token,
    },
  })
}

// ── STS GetCallerIdentity ─────────────────────────────────────────────

export type AwsIdentity = {
  accountId: string
  arn: string
  userId: string
}

export async function awsIdentity(credential: AwsCredential): Promise<AwsIdentity> {
  const sts = createAwsClient(credential, STSClient)
  const result = await sts.send(new GetCallerIdentityCommand({}))
  return {
    accountId: result.Account ?? "unknown",
    arn: result.Arn ?? "unknown",
    userId: result.UserId ?? "unknown",
  }
}

// ── Error parsing ─────────────────────────────────────────────────────

/**
 * Strip potential secrets (40-char base64 strings that look like AWS secret keys)
 * from error messages before returning to client.
 */
function sanitizeErrorMessage(msg: string): string {
  return msg.replace(/[A-Za-z0-9/+=]{40}/g, "[REDACTED]")
}

export function parseAwsError(error: unknown): { status: number; message: string } {
  if (!error || typeof error !== "object") {
    return { status: 500, message: "Unknown AWS error" }
  }

  const err = error as {
    name?: string
    message?: string
    $metadata?: { httpStatusCode?: number }
    Code?: string
  }

  const httpStatus = err.$metadata?.httpStatusCode ?? 500
  const rawMessage = err.message ?? err.name ?? "AWS API error"
  const message = sanitizeErrorMessage(rawMessage)

  // Map common AWS error codes to HTTP statuses
  const name = err.name ?? err.Code ?? ""
  if (name === "ExpiredTokenException" || name === "ExpiredToken") {
    return { status: 401, message: "AWS credentials have expired" }
  }
  if (name === "InvalidClientTokenId" || name === "SignatureDoesNotMatch") {
    return { status: 401, message: "Invalid AWS credentials" }
  }
  if (name === "AccessDeniedException" || name === "AccessDenied" || name === "UnauthorizedAccess") {
    return { status: 403, message }
  }

  return { status: httpStatus, message }
}

// ── Generic pagination ────────────────────────────────────────────────

/**
 * Generic AWS pagination helper.
 * - sendFn: calls the SDK and returns the raw response
 * - extractItems: pulls the items array from the response
 * - extractNextToken: pulls the pagination token (or undefined when done)
 * - maxPages: safety limit to prevent runaway pagination
 */
export async function awsPaginateAll<TResponse, TItem>(
  sendFn: (nextToken?: string) => Promise<TResponse>,
  extractItems: (response: TResponse) => TItem[] | undefined,
  extractNextToken: (response: TResponse) => string | undefined,
  maxPages = 10,
): Promise<TItem[]> {
  const all: TItem[] = []
  let nextToken: string | undefined
  let page = 0

  do {
    const response = await sendFn(nextToken)
    const items = extractItems(response) ?? []
    all.push(...items)
    nextToken = extractNextToken(response)
    page++
  } while (nextToken && page < maxPages)

  return all
}
