import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { getAccessToken } from "@/lib/microsoft"
import type { MicrosoftCredential } from "@/lib/providers/types"

type ProbeResult = {
  accessible: boolean
  tokenObtained: boolean
  httpStatus?: number
  details?: unknown
  error?: string
}

/** Extract the `value` array from a successful probe result's details. */
function extractValues<T>(result: ProbeResult): T[] {
  if (!result.accessible || !result.details) return []
  const data = result.details as { value?: T[] }
  return Array.isArray(data.value) ? data.value : []
}

async function probeResource(
  credential: MicrosoftCredential,
  resource: string,
  probeUrl?: string
): Promise<ProbeResult> {
  let token: string
  try {
    token = await getAccessToken(credential, resource)
  } catch (err) {
    return {
      accessible: false,
      tokenObtained: false,
      error: err instanceof Error ? err.message : "Token acquisition failed",
    }
  }

  if (!probeUrl) {
    return { accessible: true, tokenObtained: true }
  }

  try {
    const res = await fetch(probeUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      const data = await res.json()
      return { accessible: true, tokenObtained: true, details: data }
    }

    return {
      accessible: false,
      tokenObtained: true,
      httpStatus: res.status,
    }
  } catch {
    return { accessible: false, tokenObtained: true }
  }
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    // Probe ARM, Azure Storage, and Azure DevOps in parallel
    const [armResult, storageResult, devopsResult] = await Promise.allSettled([
      probeResource(
        credential,
        "https://management.azure.com/.default",
        "https://management.azure.com/subscriptions?api-version=2022-12-01"
      ),
      probeResource(
        credential,
        "https://storage.azure.com/.default"
        // No universal list endpoint for storage
      ),
      probeResource(
        credential,
        "https://app.vscode.dev/.default",
        "https://app.vscode.dev/_apis/projects?api-version=7.0"
      ),
    ])

    const failedProbe: ProbeResult = { accessible: false, tokenObtained: false, error: "Probe failed" }

    const arm = armResult.status === "fulfilled" ? armResult.value : failedProbe
    const storage = storageResult.status === "fulfilled" ? storageResult.value : failedProbe
    const devops = devopsResult.status === "fulfilled" ? devopsResult.value : failedProbe

    // Extract subscription list from ARM result
    const subscriptions = extractValues<{ subscriptionId: string; displayName: string }>(arm)
      .map((s) => ({ id: s.subscriptionId, name: s.displayName }))

    // Key Vault probe: only if ARM succeeded and we have subscriptions
    let keyVault: ProbeResult = {
      accessible: false,
      tokenObtained: false,
      error: "Requires ARM access with subscriptions",
    }

    if (arm.accessible && subscriptions.length > 0) {
      // Use the ARM token (same scope) to list Key Vault resources
      const firstSubId = subscriptions[0].id
      const kvUrl =
        `https://management.azure.com/subscriptions/${firstSubId}/resources` +
        `?$filter=resourceType eq 'Microsoft.KeyVault/vaults'&api-version=2021-04-01`

      keyVault = await probeResource(
        credential,
        "https://management.azure.com/.default",
        kvUrl
      )
    } else if (arm.tokenObtained && !arm.accessible) {
      // ARM token obtained but no access -- Key Vault inherits that state
      keyVault = { accessible: false, tokenObtained: true }
    }

    // Extract vault names and DevOps project names
    const vaults = extractValues<{ name: string }>(keyVault).map((v) => v.name)
    const projects = extractValues<{ name: string }>(devops).map((p) => p.name)

    return NextResponse.json({
      arm: {
        accessible: arm.accessible,
        tokenObtained: arm.tokenObtained,
        subscriptions: arm.accessible ? subscriptions : undefined,
        httpStatus: arm.httpStatus,
        error: arm.error,
      },
      keyVault: {
        accessible: keyVault.accessible,
        tokenObtained: keyVault.tokenObtained,
        vaults: keyVault.accessible ? vaults : undefined,
        httpStatus: keyVault.httpStatus,
        error: keyVault.error,
      },
      storage: {
        accessible: storage.accessible,
        tokenObtained: storage.tokenObtained,
        httpStatus: storage.httpStatus,
        error: storage.error,
      },
      devops: {
        accessible: devops.accessible,
        tokenObtained: devops.tokenObtained,
        projects: devops.accessible ? projects : undefined,
        httpStatus: devops.httpStatus,
        error: devops.error,
      },
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
