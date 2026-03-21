import type {
  BaseCredential,
  GcpApiKeyCredential,
  ServiceProvider,
} from "./types"
import { probeGcpApi, parseGcpKeyError } from "@/lib/gcp-key"

// ── Detection helpers ─────────────────────────────────────────────────

function isGcpApiKey(s: string): boolean {
  return /^AIza[A-Za-z0-9_-]{35}$/.test(s.trim())
}

// ── Provider ──────────────────────────────────────────────────────────

export const gcpProvider: ServiceProvider = {
  id: "gcp",
  name: "GCP",
  description: "Firebase, Cloud Storage, Compute, Vertex AI",
  iconName: "Flame",

  detectCredential(raw: unknown): boolean {
    // Raw string: "AIza..."
    if (typeof raw === "string" && isGcpApiKey(raw)) return true
    // Object with api_key field
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      if (obj.provider === "gcp") return true
      if (typeof obj.api_key === "string" && isGcpApiKey(obj.api_key)) return true
      if (typeof obj.apiKey === "string" && isGcpApiKey(obj.apiKey)) return true
      if (typeof obj.key === "string" && isGcpApiKey(obj.key)) return true
    }
    return false
  },

  validateCredential(
    raw: unknown,
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {
    let apiKey: string | undefined
    let projectId: string | undefined

    if (typeof raw === "string") {
      apiKey = raw.trim()
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      apiKey = (obj.api_key ?? obj.apiKey ?? obj.key) as string | undefined
      projectId = (obj.project_id ?? obj.projectId) as string | undefined
    }

    if (!apiKey || !isGcpApiKey(apiKey)) {
      return {
        valid: false,
        error: "Invalid Google API key (expected AIza* prefix, 39 chars)",
      }
    }

    const credential: GcpApiKeyCredential = {
      provider: "gcp",
      credentialKind: "api-key",
      api_key: apiKey,
      project_id: projectId,
    }

    return { valid: true, credential }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    // API keys are not bearer tokens — return the key itself as identifier
    return (credential as GcpApiKeyCredential).api_key
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    // API keys have no OAuth scopes. Probe which APIs are enabled.
    const key = (credential as GcpApiKeyCredential).api_key

    const probes: { scope: string; url: string }[] = [
      {
        scope: "firestore.googleapis.com",
        url: "https://firestore.googleapis.com/v1/projects/-/databases",
      },
      {
        scope: "firebaseio.com",
        url: "https://firebasedatabase.googleapis.com/v1beta/projects/-/instances",
      },
      {
        scope: "storage.googleapis.com",
        url: "https://storage.googleapis.com/storage/v1/b?project=_",
      },
      {
        scope: "compute.googleapis.com",
        url: "https://compute.googleapis.com/compute/v1/projects/-/zones",
      },
      {
        scope: "aiplatform.googleapis.com",
        url: "https://us-central1-aiplatform.googleapis.com/v1/projects/-/locations/us-central1/models",
      },
    ]

    const results = await Promise.allSettled(
      probes.map(async (p) => {
        const ok = await probeGcpApi(p.url, key)
        return ok ? p.scope : null
      }),
    )

    return results
      .filter(
        (r): r is PromiseFulfilledResult<string> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value)
  },

  emailEndpoint: "/api/gcp-key/me",
  defaultRoute: "/gcp-dashboard",

  operateNavItems: [
    { id: "gcp-firestore", title: "Firestore", href: "/gcp-firestore", iconName: "Database" },
    { id: "gcp-rtdb", title: "Realtime DB", href: "/gcp-rtdb", iconName: "Zap" },
    { id: "gcp-storage", title: "Storage", href: "/gcp-storage", iconName: "HardDrive" },
    { id: "gcp-compute", title: "Compute", href: "/gcp-compute", iconName: "Server" },
    { id: "gcp-vertexai", title: "Vertex AI", href: "/gcp-vertexai", iconName: "Brain" },
  ],

  auditNavItems: [],

  scopeAppMap: {
    "gcp-firestore": ["firestore.googleapis.com"],
    "gcp-rtdb": ["firebaseio.com"],
    "gcp-storage": ["storage.googleapis.com"],
    "gcp-compute": ["compute.googleapis.com"],
    "gcp-vertexai": ["aiplatform.googleapis.com"],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null
    const err = error as { code?: number; message?: string }
    if (err.code || err.message) {
      return parseGcpKeyError(error)
    }
    return null
  },

  canRefresh(): boolean {
    return false
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as GcpApiKeyCredential
    return {
      provider: "gcp",
      credentialKind: "api-key",
      api_key: c.api_key,
      project_id: c.project_id,
    } as GcpApiKeyCredential
  },
}
