export type SpaClientEntry = {
  clientId: string
  name: string
  origin: string
  defaultResource: string
  knownResources: string[]
  isFoci: boolean
  notes?: string
}

/** Built-in known SPA clients */
const BUILTIN_CLIENTS: SpaClientEntry[] = [
  {
    clientId: "9199bf20-a13f-4107-85dc-02114787ef48",
    name: "One Outlook Web (OWA)",
    origin: "https://outlook.office.com",
    defaultResource: "https://graph.microsoft.com/.default",
    knownResources: [
      "https://graph.microsoft.com",
      "https://outlook.office365.com",
      "https://substrate.office.com",
    ],
    isFoci: false,
    notes: "17 cached ATs across 16 services. NOT FOCI.",
  },
  {
    clientId: "5e3ce6c0-2b1f-4285-8d4b-75ee78787346",
    name: "Microsoft Teams Web Client",
    origin: "https://teams.cloud.microsoft",
    defaultResource: "https://graph.microsoft.com/.default",
    knownResources: [
      "https://graph.microsoft.com",
      "https://presence.teams.microsoft.com",
      "https://api.spaces.skype.com",
    ],
    isFoci: false,
    notes: "18 cached ATs across 15 resource audiences. NOT FOCI.",
  },
]

/** Runtime-discovered clients (persisted only for the session lifetime) */
const runtimeClients = new Map<string, SpaClientEntry>()

/** Look up a SPA client entry by client ID */
export function getSpaClient(clientId: string): SpaClientEntry | undefined {
  return (
    runtimeClients.get(clientId) ??
    BUILTIN_CLIENTS.find((c) => c.clientId === clientId)
  )
}

/** Check whether a client_id is a known SPA client */
export function isSpaClientId(clientId: string): boolean {
  return (
    runtimeClients.has(clientId) ||
    BUILTIN_CLIENTS.some((c) => c.clientId === clientId)
  )
}

/** Return all known SPA clients (builtin + runtime) */
export function getAllSpaClients(): SpaClientEntry[] {
  const all = [...BUILTIN_CLIENTS]
  for (const [id, entry] of runtimeClients) {
    if (!all.some((c) => c.clientId === id)) {
      all.push(entry)
    }
  }
  return all
}

/** Register a SPA client at runtime (e.g., discovered from AADSTS9002327 errors) */
export function registerSpaClient(entry: SpaClientEntry): void {
  runtimeClients.set(entry.clientId, entry)
}

/**
 * Parse an AADSTS9002327 error body to extract the client_id that requires SPA.
 * AADSTS9002327: "Tokens issued for the 'Single-Page Application' client-type
 * may only be redeemed via cross-origin requests."
 * Returns the client_id if found, null otherwise.
 */
export function detectSpaClientFromError(errorBody: string): string | null {
  // The error body may contain `client_id` in the JSON payload
  try {
    const parsed = JSON.parse(errorBody)
    // Azure AD errors sometimes include the client_id in suberror or additional_info
    if (parsed?.client_id && typeof parsed.client_id === "string") {
      return parsed.client_id
    }
  } catch {
    // Not JSON — try regex on the raw text
  }

  // Match a GUID pattern near "client" or "application" keywords
  const guidPattern =
    /(?:client[_\s-]?id|application)['":\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  const match = errorBody.match(guidPattern)
  return match?.[1] ?? null
}
