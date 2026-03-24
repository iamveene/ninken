/**
 * FOCI (Family of Client IDs) database.
 * Microsoft first-party apps that share refresh tokens within the same family.
 * A refresh token obtained for one FOCI app can be exchanged for tokens to any other app in the family.
 */

export interface FociClient {
  clientId: string
  name: string
  /** Family ID (currently only "1" is known) */
  familyId: string
  /** Whether this client is commonly available to users */
  commonlyAvailable: boolean
  /** Notable scopes this app can request */
  notableScopes: string[]
  /** Red team notes */
  notes?: string
}

export const FOCI_CLIENTS: FociClient[] = [
  {
    clientId: "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    name: "Microsoft Teams",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Team.ReadBasic.All", "Channel.ReadBasic.All", "Chat.Read", "Files.Read"],
    notes: "Very commonly available. Good starting point for FOCI exchange.",
  },
  {
    clientId: "d3590ed6-52b3-4102-aeff-aad2292ab01c",
    name: "Microsoft Office",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Mail.Read", "Files.ReadWrite", "Sites.Read.All"],
    notes: "One of the most versatile FOCI clients. Broad scope access.",
  },
  {
    clientId: "27922004-5251-4030-b22d-91ecd9a37ea4",
    name: "Outlook Mobile",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Mail.Read", "Mail.Send", "Calendars.Read", "Contacts.Read"],
  },
  {
    clientId: "4e291c71-d680-4d0e-9640-0a3358e31177",
    name: "PowerAutomate",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Flow.Read.All", "Mail.Send", "Sites.ReadWrite.All"],
    notes: "Can potentially trigger automation flows.",
  },
  {
    clientId: "ab9b8c07-8f02-4f72-87fa-80105867a763",
    name: "OneDrive SyncEngine",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Files.ReadWrite.All", "Sites.ReadWrite.All"],
    notes: "Broad file access scope. Useful for data exfiltration scenarios.",
  },
  {
    clientId: "0ec893e0-5785-4de6-99da-4ed124e5296c",
    name: "Office365 Shell WCSS-Client",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Mail.Read", "Files.Read", "User.Read"],
  },
  {
    clientId: "872cd9fa-d31f-45e0-9eab-6e460a02d1f1",
    name: "Visual Studio",
    familyId: "1",
    commonlyAvailable: false,
    notableScopes: ["User.Read", "openid", "profile"],
    notes: "May not be available in all tenants. Developer-oriented.",
  },
  {
    clientId: "af124e86-4e96-495a-b70a-90f90ab96707",
    name: "OneDrive iOS",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Files.ReadWrite.All"],
  },
  {
    clientId: "2d7f3606-b07d-41d1-b9d2-0d0c9296a6e8",
    name: "Microsoft Bing Search",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["User.Read"],
    notes: "Limited scopes but useful for validating FOCI exchange.",
  },
  {
    clientId: "844cca35-0656-46ce-b636-13f48b0eecbd",
    name: "Microsoft Stream Mobile",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Files.Read", "Sites.Read.All"],
  },
  {
    clientId: "87749df4-7ccf-48f8-aa87-704bad0e0e16",
    name: "Microsoft Teams - Device Admin Agent",
    familyId: "1",
    commonlyAvailable: false,
    notableScopes: ["DeviceManagementManagedDevices.Read.All"],
    notes: "Access to Intune device management data.",
  },
  {
    clientId: "cf36b471-5b44-428c-9ce7-313bf84528de",
    name: "Microsoft Bing",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["User.Read"],
  },
  {
    clientId: "26a7ee05-5602-4d76-a7ba-eae8b7b67941",
    name: "Windows Search",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Files.Read.All", "Sites.Read.All"],
  },
  {
    clientId: "00b41c95-dab0-4487-9791-b9d2c32c80f2",
    name: "Office 365 Management",
    familyId: "1",
    commonlyAvailable: false,
    notableScopes: ["ServiceHealth.Read", "ActivityFeed.Read"],
    notes: "Access to management activity logs.",
  },
  {
    clientId: "4345a7b9-9a63-4910-a426-35363201d503",
    name: "O365 Suite UX",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["Mail.Read", "Files.Read", "Calendars.Read"],
  },
  {
    clientId: "89bee1f7-5e6e-4d8a-9f3d-ecd601259da7",
    name: "Office365 Shell WCSS-Client (alternate)",
    familyId: "1",
    commonlyAvailable: true,
    notableScopes: ["User.Read", "openid"],
  },
]

/**
 * Look up a FOCI client by client ID.
 */
export function getFociClient(clientId: string): FociClient | undefined {
  return FOCI_CLIENTS.find((c) => c.clientId === clientId)
}

/**
 * Check if a client ID is part of a FOCI family.
 */
export function isFociClient(clientId: string): boolean {
  return FOCI_CLIENTS.some((c) => c.clientId === clientId)
}

/**
 * Get all FOCI clients in a specific family.
 */
export function getFociFamily(familyId: string): FociClient[] {
  return FOCI_CLIENTS.filter((c) => c.familyId === familyId)
}

/**
 * Get FOCI clients sorted by the number of notable scopes (most versatile first).
 */
export function getFociClientsByVersatility(): FociClient[] {
  return [...FOCI_CLIENTS].sort((a, b) => b.notableScopes.length - a.notableScopes.length)
}
