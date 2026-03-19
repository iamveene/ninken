/**
 * Query adapter registry — maps ServiceId to its search adapter.
 */

import type { QueryAdapter, ServiceId } from "../query-types"
import { gmailAdapter } from "./gmail-adapter"
import { driveAdapter } from "./drive-adapter"
import { outlookAdapter } from "./outlook-adapter"
import { onedriveAdapter } from "./onedrive-adapter"
import { calendarAdapter } from "./calendar-adapter"
import { bucketsAdapter } from "./buckets-adapter"

const ADAPTER_REGISTRY: Record<ServiceId, QueryAdapter> = {
  gmail: gmailAdapter,
  drive: driveAdapter,
  outlook: outlookAdapter,
  onedrive: onedriveAdapter,
  calendar: calendarAdapter,
  buckets: bucketsAdapter,
}

/** Google Workspace services. */
export const GOOGLE_SERVICES: ServiceId[] = ["gmail", "drive", "calendar", "buckets"]

/** Microsoft 365 services. */
export const MICROSOFT_SERVICES: ServiceId[] = ["outlook", "onedrive"]

/** All available services. */
export const ALL_SERVICES: ServiceId[] = [...GOOGLE_SERVICES, ...MICROSOFT_SERVICES]

/**
 * Get the adapter for a specific service.
 */
export function getAdapter(service: ServiceId): QueryAdapter {
  return ADAPTER_REGISTRY[service]
}

/**
 * Get adapters for a list of services.
 */
export function getAdapters(services: ServiceId[]): QueryAdapter[] {
  return services.map((s) => ADAPTER_REGISTRY[s]).filter(Boolean)
}

export {
  gmailAdapter,
  driveAdapter,
  outlookAdapter,
  onedriveAdapter,
  calendarAdapter,
  bucketsAdapter,
}
