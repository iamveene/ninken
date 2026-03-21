import type { ProviderId } from "@/lib/providers/types"

// ── Entity & Relationship Types ─────────────────────────────────────

export type EntityType =
  | "user"
  | "group"
  | "role"
  | "service-account"
  | "app"
  | "device"

export type RelationType =
  | "member-of"
  | "owner-of"
  | "delegated"
  | "role-assignment"
  | "admin-of"
  | "permission"

// ── Graph Primitives ────────────────────────────────────────────────

export type GraphNode = {
  id: string
  label: string
  type: EntityType
  provider: ProviderId
  metadata?: Record<string, unknown>
}

export type GraphEdge = {
  source: string
  target: string
  type: RelationType
  label?: string
}

export type AttackGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Visual Config ───────────────────────────────────────────────────

export const ENTITY_COLORS: Record<EntityType, string> = {
  user: "#3b82f6",
  group: "#22c55e",
  role: "#ef4444",
  "service-account": "#f97316",
  app: "#a855f7",
  device: "#6b7280",
}

export const ENTITY_LABELS: Record<EntityType, string> = {
  user: "User",
  group: "Group",
  role: "Role",
  "service-account": "Service Account",
  app: "Application",
  device: "Device",
}

export const RELATION_LABELS: Record<RelationType, string> = {
  "member-of": "Member Of",
  "owner-of": "Owner Of",
  delegated: "Delegated",
  "role-assignment": "Role Assignment",
  "admin-of": "Admin Of",
  permission: "Permission",
}

/** SVG stroke-dasharray per relation type */
export const RELATION_DASH: Record<RelationType, string> = {
  "member-of": "none",
  "owner-of": "6,3",
  delegated: "2,4",
  "role-assignment": "8,3,2,3",
  "admin-of": "none",
  permission: "4,4",
}

export const ALL_ENTITY_TYPES: EntityType[] = [
  "user",
  "group",
  "role",
  "service-account",
  "app",
  "device",
]

export const ALL_RELATION_TYPES: RelationType[] = [
  "member-of",
  "owner-of",
  "delegated",
  "role-assignment",
  "admin-of",
  "permission",
]
