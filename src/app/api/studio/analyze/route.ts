import { NextResponse } from "next/server"
import { analyzeJwt } from "@/lib/studio/jwt-decoder"
import { identifyTokenType } from "@/lib/studio/token-types"
import { analyzeScopes } from "@/lib/studio/scope-definitions"
import { badRequest } from "@/app/api/_helpers"

export const dynamic = "force-dynamic"

/**
 * POST /api/studio/analyze
 * Server-side token analysis. Accepts a token string and returns decoded information.
 * Note: The primary analyzer runs client-side. This endpoint exists for automation
 * and integration use cases where client-side JS is not available.
 */
export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const { token } = body
  if (!token || typeof token !== "string") {
    return badRequest("Missing or invalid 'token' field")
  }

  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return badRequest("Token cannot be empty")
  }

  // Identify token type by pattern
  const tokenType = identifyTokenType(trimmed)

  // Attempt JWT decode
  const jwtAnalysis = analyzeJwt(trimmed)

  // Scope analysis if scopes were found
  const scopeAnalysis = jwtAnalysis?.scopes
    ? analyzeScopes(jwtAnalysis.scopes)
    : null

  return NextResponse.json({
    tokenType: tokenType
      ? {
          id: tokenType.id,
          name: tokenType.name,
          platform: tokenType.platform,
          format: tokenType.format,
          defaultLifetime: tokenType.defaultLifetime,
          refreshable: tokenType.refreshable,
          opsecNotes: tokenType.opsecNotes,
        }
      : null,
    jwt: jwtAnalysis
      ? {
          platform: jwtAnalysis.platform,
          tokenType: jwtAnalysis.tokenType,
          claims: jwtAnalysis.claims.map((c) => ({
            key: c.key,
            value: c.value,
            label: c.label,
            category: c.category,
            sensitive: c.sensitive,
          })),
          scopes: jwtAnalysis.scopes,
          expiry: {
            issuedAt: jwtAnalysis.expiry.issuedAt?.toISOString() ?? null,
            expiresAt: jwtAnalysis.expiry.expiresAt?.toISOString() ?? null,
            isExpired: jwtAnalysis.expiry.isExpired,
            remainingSeconds: jwtAnalysis.expiry.remainingSeconds,
          },
          observations: jwtAnalysis.observations,
        }
      : null,
    scopeAnalysis: scopeAnalysis
      ? {
          found: scopeAnalysis.found.map((s) => ({
            scope: s.scope,
            name: s.name,
            risk: s.risk,
            writeAccess: s.writeAccess,
            redTeamValue: s.redTeamValue,
          })),
          unknown: scopeAnalysis.unknown,
          riskSummary: scopeAnalysis.riskSummary,
          maxRisk: scopeAnalysis.maxRisk,
          hasWriteAccess: scopeAnalysis.hasWriteAccess,
        }
      : null,
  })
}
