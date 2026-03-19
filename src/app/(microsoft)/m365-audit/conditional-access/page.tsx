"use client"

import { useState, useMemo, Fragment } from "react"
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Users,
  AppWindow,
  MapPin,
  Monitor,
  Lock,
  Clock,
} from "lucide-react"
import { useConditionalAccessPolicies } from "@/hooks/use-m365-audit"
import type {
  ConditionalAccessPolicy,
  NamedLocation,
  CAConditions,
  CAGrantControls,
  CASessionControls,
} from "@/hooks/use-m365-audit"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { ExportButton } from "@/components/layout/export-button"
import { formatDistanceToNow } from "date-fns"

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type StateFilter = "all" | "enabled" | "disabled" | "reportOnly"
type GrantFilter = "all" | "requiresMfa" | "requiresCompliant" | "requiresHybridJoin"
type ScopeFilter = "all" | "targetsAllUsers" | "riskBased"

// ---------------------------------------------------------------------------
// Human-readable label helpers
// ---------------------------------------------------------------------------

const GRANT_CONTROL_LABELS: Record<string, string> = {
  mfa: "Require MFA",
  compliantDevice: "Require Compliant Device",
  domainJoinedDevice: "Require Hybrid Azure AD Join",
  approvedApplication: "Require Approved App",
  compliantApplication: "Require App Protection Policy",
  passwordChange: "Require Password Change",
  block: "Block Access",
}

const PLATFORM_LABELS: Record<string, string> = {
  android: "Android",
  iOS: "iOS",
  windows: "Windows",
  macOS: "macOS",
  linux: "Linux",
  windowsPhone: "Windows Phone",
  all: "All Platforms",
}

const CLIENT_APP_LABELS: Record<string, string> = {
  browser: "Browser",
  mobileAppsAndDesktopClients: "Mobile & Desktop",
  exchangeActiveSync: "Exchange ActiveSync",
  other: "Other (Legacy Auth)",
}

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  hidden: "Hidden",
  none: "None",
}

function grantControlLabel(control: string): string {
  return GRANT_CONTROL_LABELS[control] ?? control
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}

function clientAppLabel(app: string): string {
  return CLIENT_APP_LABELS[app] ?? app
}

function riskLabel(level: string): string {
  return RISK_LEVEL_LABELS[level] ?? level
}

// ---------------------------------------------------------------------------
// Named location resolver
// ---------------------------------------------------------------------------

function buildLocationMap(locations: NamedLocation[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const loc of locations) {
    map.set(loc.id, loc.displayName)
  }
  return map
}

function resolveLocationId(id: string, locationMap: Map<string, string>): string {
  if (id === "All") return "All Locations"
  if (id === "AllTrusted") return "All Trusted Locations"
  return locationMap.get(id) ?? id
}

// ---------------------------------------------------------------------------
// State badge with colored styling
// ---------------------------------------------------------------------------

function stateBadge(state: string) {
  switch (state) {
    case "enabled":
      return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Enabled</Badge>
    case "disabled":
      return <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
    case "enabledForReportingButNotEnforced":
      return <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">Report Only</Badge>
    default:
      return <span className="text-muted-foreground">{state}</span>
  }
}

// ---------------------------------------------------------------------------
// Condition summary (table row)
// ---------------------------------------------------------------------------

function summarizeConditions(conditions: CAConditions | undefined): string {
  if (!conditions) return "--"
  const parts: string[] = []

  const users = conditions.users
  if (users) {
    if (users.includeUsers?.includes("All")) {
      parts.push("All users")
    } else if (users.includeUsers?.includes("GuestsOrExternalUsers")) {
      parts.push("All guests")
    } else if (users.includeUsers?.length || users.includeGroups?.length) {
      const count = (users.includeUsers?.length ?? 0) + (users.includeGroups?.length ?? 0)
      parts.push(`${count} user/group target${count > 1 ? "s" : ""}`)
    }
  }

  const apps = conditions.applications
  if (apps) {
    if (apps.includeApplications?.includes("All")) {
      parts.push("All apps")
    } else if (apps.includeApplications?.length) {
      parts.push(`${apps.includeApplications.length} app${apps.includeApplications.length > 1 ? "s" : ""}`)
    }
  }

  if (conditions.signInRiskLevels?.length || conditions.userRiskLevels?.length) {
    parts.push("Risk-based")
  }

  return parts.length > 0 ? parts.join("; ") : "--"
}

// ---------------------------------------------------------------------------
// Grant controls summary (table row)
// ---------------------------------------------------------------------------

function summarizeGrantControls(controls: CAGrantControls | null): string {
  if (!controls) return "--"
  const builtIn = controls.builtInControls ?? []
  if (builtIn.length === 0) return "--"
  const op = controls.operator ?? "OR"
  return builtIn.map(grantControlLabel).join(` ${op} `)
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function matchesStateFilter(policy: ConditionalAccessPolicy, filter: StateFilter): boolean {
  switch (filter) {
    case "enabled": return policy.state === "enabled"
    case "disabled": return policy.state === "disabled"
    case "reportOnly": return policy.state === "enabledForReportingButNotEnforced"
    default: return true
  }
}

function matchesGrantFilter(policy: ConditionalAccessPolicy, filter: GrantFilter): boolean {
  if (filter === "all") return true
  const controls = policy.grantControls?.builtInControls ?? []
  switch (filter) {
    case "requiresMfa": return controls.includes("mfa")
    case "requiresCompliant": return controls.includes("compliantDevice")
    case "requiresHybridJoin": return controls.includes("domainJoinedDevice")
    default: return true
  }
}

function matchesScopeFilter(policy: ConditionalAccessPolicy, filter: ScopeFilter): boolean {
  if (filter === "all") return true
  switch (filter) {
    case "targetsAllUsers":
      return policy.conditions?.users?.includeUsers?.includes("All") ?? false
    case "riskBased":
      return (
        (policy.conditions?.signInRiskLevels?.length ?? 0) > 0 ||
        (policy.conditions?.userRiskLevels?.length ?? 0) > 0
      )
    default:
      return true
  }
}

function matchesSearch(policy: ConditionalAccessPolicy, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return policy.displayName?.toLowerCase().includes(q) || false
}

// ---------------------------------------------------------------------------
// Expanded row: human-readable conditions detail
// ---------------------------------------------------------------------------

function ConditionSection({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="text-sm text-muted-foreground pl-5">
        {children}
      </div>
    </div>
  )
}

function UserConditionDetail({ users }: { users: CAConditions["users"] }) {
  if (!users) return <span>Not configured</span>
  return (
    <div className="space-y-1">
      <div>
        <span className="text-foreground font-medium">Include: </span>
        {users.includeUsers?.includes("All")
          ? "All Users"
          : users.includeUsers?.includes("GuestsOrExternalUsers")
            ? "All Guests / External Users"
            : users.includeUsers?.includes("None")
              ? "None"
              : [
                  ...(users.includeUsers?.map((id) => id) ?? []),
                  ...(users.includeGroups?.map((id) => `Group:${id.slice(0, 8)}`) ?? []),
                  ...(users.includeRoles?.map((id) => `Role:${id.slice(0, 8)}`) ?? []),
                ].join(", ") || "None"
        }
      </div>
      {((users.excludeUsers?.length ?? 0) > 0 ||
        (users.excludeGroups?.length ?? 0) > 0 ||
        (users.excludeRoles?.length ?? 0) > 0) && (
        <div>
          <span className="text-foreground font-medium">Exclude: </span>
          {[
            ...(users.excludeUsers?.includes("GuestsOrExternalUsers") ? ["Guests"] : (users.excludeUsers ?? [])),
            ...(users.excludeGroups?.map((id) => `Group:${id.slice(0, 8)}`) ?? []),
            ...(users.excludeRoles?.map((id) => `Role:${id.slice(0, 8)}`) ?? []),
          ].join(", ")}
        </div>
      )}
    </div>
  )
}

function ApplicationConditionDetail({ apps }: { apps: CAConditions["applications"] }) {
  if (!apps) return <span>Not configured</span>
  return (
    <div className="space-y-1">
      <div>
        <span className="text-foreground font-medium">Include: </span>
        {apps.includeApplications?.includes("All")
          ? "All Applications"
          : apps.includeApplications?.includes("None")
            ? "None"
            : apps.includeApplications?.includes("Office365")
              ? "Office 365"
              : `${apps.includeApplications?.length ?? 0} application(s)`}
      </div>
      {(apps.excludeApplications?.length ?? 0) > 0 && (
        <div>
          <span className="text-foreground font-medium">Exclude: </span>
          {`${apps.excludeApplications?.length} application(s)`}
        </div>
      )}
      {(apps.includeUserActions?.length ?? 0) > 0 && (
        <div>
          <span className="text-foreground font-medium">User actions: </span>
          {apps.includeUserActions?.join(", ")}
        </div>
      )}
    </div>
  )
}

function LocationConditionDetail({
  locations,
  locationMap,
}: {
  locations: CAConditions["locations"]
  locationMap: Map<string, string>
}) {
  if (!locations) return <span>Not configured</span>
  return (
    <div className="space-y-1">
      {(locations.includeLocations?.length ?? 0) > 0 && (
        <div>
          <span className="text-foreground font-medium">Include: </span>
          {locations.includeLocations?.map((id) => resolveLocationId(id, locationMap)).join(", ")}
        </div>
      )}
      {(locations.excludeLocations?.length ?? 0) > 0 && (
        <div>
          <span className="text-foreground font-medium">Exclude: </span>
          {locations.excludeLocations?.map((id) => resolveLocationId(id, locationMap)).join(", ")}
        </div>
      )}
    </div>
  )
}

function PlatformConditionDetail({ platforms }: { platforms: CAConditions["platforms"] }) {
  if (!platforms) return <span>Not configured (all platforms)</span>
  return (
    <div className="space-y-1">
      <div>
        <span className="text-foreground font-medium">Include: </span>
        {platforms.includePlatforms?.map(platformLabel).join(", ") || "None"}
      </div>
      {(platforms.excludePlatforms?.length ?? 0) > 0 && (
        <div>
          <span className="text-foreground font-medium">Exclude: </span>
          {platforms.excludePlatforms?.map(platformLabel).join(", ")}
        </div>
      )}
    </div>
  )
}

function GrantControlsBadges({ controls }: { controls: CAGrantControls | null }) {
  if (!controls) return <span className="text-muted-foreground">No grant controls</span>
  const builtIn = controls.builtInControls ?? []
  if (builtIn.length === 0 && !controls.authenticationStrength) {
    return <span className="text-muted-foreground">No grant controls</span>
  }

  const op = controls.operator ?? "OR"
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {builtIn.map((control, i) => (
        <Fragment key={control}>
          {i > 0 && (
            <span className="text-xs text-muted-foreground font-mono">{op}</span>
          )}
          <Badge
            variant={control === "block" ? "destructive" : "secondary"}
            className={
              control === "mfa"
                ? "bg-blue-600/20 text-blue-400 border-blue-600/30"
                : control === "block"
                  ? ""
                  : undefined
            }
          >
            {grantControlLabel(control)}
          </Badge>
        </Fragment>
      ))}
      {controls.authenticationStrength?.displayName && (
        <>
          {builtIn.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">{op}</span>
          )}
          <Badge variant="secondary">
            Strength: {controls.authenticationStrength.displayName}
          </Badge>
        </>
      )}
    </div>
  )
}

function SessionControlsDetail({ session }: { session: CASessionControls | null }) {
  if (!session) return null
  const parts: { label: string; value: string }[] = []

  if (session.signInFrequency?.isEnabled) {
    const freq = session.signInFrequency
    const interval = freq.frequencyInterval === "timeBased"
      ? `${freq.value} ${freq.type === "hours" ? "hour(s)" : "day(s)"}`
      : freq.frequencyInterval === "everyTime"
        ? "Every time"
        : `${freq.value ?? ""} ${freq.type ?? ""}`.trim()
    parts.push({ label: "Sign-in frequency", value: interval })
  }

  if (session.persistentBrowser?.isEnabled) {
    parts.push({
      label: "Persistent browser",
      value: session.persistentBrowser.mode === "always" ? "Always" : "Never",
    })
  }

  if (session.applicationEnforcedRestrictions?.isEnabled) {
    parts.push({ label: "App-enforced restrictions", value: "Enabled" })
  }

  if (session.cloudAppSecurity?.isEnabled) {
    parts.push({
      label: "Cloud App Security",
      value: session.cloudAppSecurity.cloudAppSecurityType ?? "Enabled",
    })
  }

  if (session.continuousAccessEvaluation?.mode) {
    parts.push({
      label: "Continuous access evaluation",
      value: session.continuousAccessEvaluation.mode,
    })
  }

  if (parts.length === 0) return null

  return (
    <div className="space-y-1">
      {parts.map((p) => (
        <div key={p.label} className="text-sm">
          <span className="text-foreground font-medium">{p.label}: </span>
          <span className="text-muted-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coverage gap analysis
// ---------------------------------------------------------------------------

type CoverageGaps = {
  totalEnabled: number
  policiesTargetingAllUsers: number
  policiesRequiringMfa: number
  hasLegacyAuthBlock: boolean
  riskBasedPolicies: number
  policiesTargetingAllApps: number
  reportOnlyCount: number
}

function computeCoverageGaps(policies: ConditionalAccessPolicy[]): CoverageGaps {
  const active = policies.filter((p) => p.state === "enabled")
  const reportOnly = policies.filter((p) => p.state === "enabledForReportingButNotEnforced")

  const policiesTargetingAllUsers = active.filter(
    (p) => p.conditions?.users?.includeUsers?.includes("All")
  ).length

  const policiesRequiringMfa = active.filter(
    (p) => p.grantControls?.builtInControls?.includes("mfa")
  ).length

  const policiesTargetingAllApps = active.filter(
    (p) => p.conditions?.applications?.includeApplications?.includes("All")
  ).length

  // Check if any enabled policy blocks legacy auth clients
  const hasLegacyAuthBlock = active.some((p) => {
    const clientApps = p.conditions?.clientAppTypes ?? []
    const blocks = p.grantControls?.builtInControls?.includes("block")
    const hasLegacyClients = clientApps.includes("exchangeActiveSync") || clientApps.includes("other")
    return blocks && hasLegacyClients
  })

  const riskBasedPolicies = active.filter(
    (p) =>
      (p.conditions?.signInRiskLevels?.length ?? 0) > 0 ||
      (p.conditions?.userRiskLevels?.length ?? 0) > 0
  ).length

  return {
    totalEnabled: active.length,
    policiesTargetingAllUsers,
    policiesRequiringMfa,
    hasLegacyAuthBlock,
    riskBasedPolicies,
    policiesTargetingAllApps,
    reportOnlyCount: reportOnly.length,
  }
}

function CoverageGapCard({ gaps }: { gaps: CoverageGaps }) {
  const findings: { severity: "high" | "medium" | "info"; text: string }[] = []

  if (gaps.policiesRequiringMfa === 0) {
    findings.push({ severity: "high", text: "No enabled policy requires MFA" })
  }

  if (!gaps.hasLegacyAuthBlock) {
    findings.push({ severity: "high", text: "No policy blocks legacy authentication" })
  }

  if (gaps.policiesTargetingAllUsers === 0) {
    findings.push({ severity: "medium", text: "No enabled policy targets All Users" })
  }

  if (gaps.policiesTargetingAllApps === 0) {
    findings.push({ severity: "medium", text: "No enabled policy targets All Applications" })
  }

  if (gaps.riskBasedPolicies === 0) {
    findings.push({ severity: "medium", text: "No risk-based policies are enabled" })
  }

  if (gaps.reportOnlyCount > 0) {
    findings.push({
      severity: "info",
      text: `${gaps.reportOnlyCount} polic${gaps.reportOnlyCount === 1 ? "y is" : "ies are"} in report-only mode`,
    })
  }

  if (findings.length === 0) return null

  return (
    <Card className="border-amber-600/30">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold text-sm">Coverage Gap Analysis</h3>
        </div>
        <div className="grid gap-2">
          {findings.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {f.severity === "high" ? (
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              ) : f.severity === "medium" ? (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              )}
              <span className={
                f.severity === "high"
                  ? "text-red-400"
                  : f.severity === "medium"
                    ? "text-amber-400"
                    : "text-muted-foreground"
              }>
                {f.text}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Expanded policy detail row
// ---------------------------------------------------------------------------

function PolicyDetail({
  policy,
  locationMap,
}: {
  policy: ConditionalAccessPolicy
  locationMap: Map<string, string>
}) {
  const conditions = policy.conditions
  const hasRisk =
    (conditions?.signInRiskLevels?.length ?? 0) > 0 ||
    (conditions?.userRiskLevels?.length ?? 0) > 0
  const hasClientAppTypes = (conditions?.clientAppTypes?.length ?? 0) > 0

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Left: Conditions */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold border-b border-border pb-1">Conditions</h4>

        <ConditionSection
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          title="Users & Groups"
        >
          <UserConditionDetail users={conditions?.users} />
        </ConditionSection>

        <ConditionSection
          icon={<AppWindow className="h-4 w-4 text-muted-foreground" />}
          title="Applications"
        >
          <ApplicationConditionDetail apps={conditions?.applications} />
        </ConditionSection>

        {conditions?.platforms && (
          <ConditionSection
            icon={<Monitor className="h-4 w-4 text-muted-foreground" />}
            title="Platforms"
          >
            <PlatformConditionDetail platforms={conditions.platforms} />
          </ConditionSection>
        )}

        {conditions?.locations && (
          <ConditionSection
            icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
            title="Locations"
          >
            <LocationConditionDetail
              locations={conditions.locations}
              locationMap={locationMap}
            />
          </ConditionSection>
        )}

        {hasRisk && (
          <ConditionSection
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            title="Risk Levels"
          >
            <div className="space-y-1">
              {(conditions?.signInRiskLevels?.length ?? 0) > 0 && (
                <div>
                  <span className="text-foreground font-medium">Sign-in risk: </span>
                  {conditions?.signInRiskLevels?.map(riskLabel).join(", ")}
                </div>
              )}
              {(conditions?.userRiskLevels?.length ?? 0) > 0 && (
                <div>
                  <span className="text-foreground font-medium">User risk: </span>
                  {conditions?.userRiskLevels?.map(riskLabel).join(", ")}
                </div>
              )}
            </div>
          </ConditionSection>
        )}

        {hasClientAppTypes && (
          <ConditionSection
            icon={<AppWindow className="h-4 w-4 text-muted-foreground" />}
            title="Client App Types"
          >
            <span>{conditions?.clientAppTypes?.map(clientAppLabel).join(", ")}</span>
          </ConditionSection>
        )}
      </div>

      {/* Right: Controls */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold border-b border-border pb-1">Controls</h4>

        <ConditionSection
          icon={<Lock className="h-4 w-4 text-muted-foreground" />}
          title="Grant Controls"
        >
          <GrantControlsBadges controls={policy.grantControls} />
        </ConditionSection>

        {policy.sessionControls && (
          <ConditionSection
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            title="Session Controls"
          >
            <SessionControlsDetail session={policy.sessionControls} />
            {!sessionControlsHasContent(policy.sessionControls) && (
              <span>Not configured</span>
            )}
          </ConditionSection>
        )}
      </div>
    </div>
  )
}

function sessionControlsHasContent(session: CASessionControls | null): boolean {
  if (!session) return false
  return !!(
    session.signInFrequency?.isEnabled ||
    session.persistentBrowser?.isEnabled ||
    session.applicationEnforcedRestrictions?.isEnabled ||
    session.cloudAppSecurity?.isEnabled ||
    session.continuousAccessEvaluation?.mode
  )
}

// ---------------------------------------------------------------------------
// Static filter option arrays (defined outside component to avoid re-creation)
// ---------------------------------------------------------------------------

const GRANT_FILTERS: { key: GrantFilter; label: string }[] = [
  { key: "all", label: "Any Control" },
  { key: "requiresMfa", label: "Requires MFA" },
  { key: "requiresCompliant", label: "Compliant Device" },
  { key: "requiresHybridJoin", label: "Hybrid Join" },
]

const SCOPE_FILTERS: { key: ScopeFilter; label: string }[] = [
  { key: "all", label: "Any Scope" },
  { key: "targetsAllUsers", label: "All Users" },
  { key: "riskBased", label: "Risk-Based" },
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ConditionalAccessPage() {
  const { policies, namedLocations, loading, error } = useConditionalAccessPolicies()
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<StateFilter>("all")
  const [grantFilter, setGrantFilter] = useState<GrantFilter>("all")
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const locationMap = useMemo(() => buildLocationMap(namedLocations), [namedLocations])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const { stats, coverageGaps } = useMemo(() => {
    const total = policies.length
    const enabledPolicies = policies.filter((p) => p.state === "enabled")
    const disabledCount = policies.filter((p) => p.state === "disabled").length
    const reportOnlyPolicies = policies.filter(
      (p) => p.state === "enabledForReportingButNotEnforced"
    )
    return {
      stats: {
        total,
        enabled: enabledPolicies.length,
        disabled: disabledCount,
        reportOnly: reportOnlyPolicies.length,
      },
      coverageGaps: computeCoverageGaps(policies),
    }
  }, [policies])

  const filtered = useMemo(
    () =>
      policies.filter(
        (p) =>
          matchesStateFilter(p, stateFilter) &&
          matchesGrantFilter(p, grantFilter) &&
          matchesScopeFilter(p, scopeFilter) &&
          matchesSearch(p, search)
      ),
    [policies, stateFilter, grantFilter, scopeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const stateFilters: { key: StateFilter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "enabled", label: "Enabled", count: stats.enabled },
    { key: "disabled", label: "Disabled", count: stats.disabled },
    { key: "reportOnly", label: "Report Only", count: stats.reportOnly },
  ]

  const exportData = filtered.map((p) => ({
    name: p.displayName,
    state: p.state,
    conditions: summarizeConditions(p.conditions),
    grantControls: summarizeGrantControls(p.grantControls),
    created: p.createdDateTime,
    modified: p.modifiedDateTime,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Conditional Access Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review conditional access policies configured in the tenant, their state, conditions, and grant controls.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-conditional-access"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load conditional access policies"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "Policy.Read.All permission is required to access conditional access policies."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Coverage gap analysis */}
          {!loading && policies.length > 0 && (
            <CoverageGapCard gaps={coverageGaps} />
          )}

          {/* Stats cards */}
          {!loading && policies.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total Policies</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Enabled</p>
                  <p className="text-2xl font-bold text-green-400">{stats.enabled}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Disabled</p>
                  <p className="text-2xl font-bold">{stats.disabled}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Report Only</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.reportOnly}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters row */}
          <div className="flex flex-col gap-3">
            {/* Search + state filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by policy name..."
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {stateFilters.map((f) => (
                  <Button
                    key={f.key}
                    variant={stateFilter === f.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setStateFilter(f.key)}
                  >
                    {f.label}
                    {!loading && f.count !== undefined && (
                      <span className="ml-1 text-xs text-muted-foreground">{f.count}</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Grant + scope filters */}
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-xs text-muted-foreground mr-1">Grant:</span>
              {GRANT_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={grantFilter === f.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGrantFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground mx-2">|</span>
              <span className="text-xs text-muted-foreground mr-1">Scope:</span>
              {SCOPE_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={scopeFilter === f.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setScopeFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No conditional access policies found</p>
              <p className="text-sm text-muted-foreground">
                No conditional access policies are configured in this tenant.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Policy Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Grant Controls</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No policies match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((policy) => {
                      const isExpanded = expandedIds.has(policy.id)
                      return (
                        <Fragment key={policy.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => toggleExpanded(policy.id)}
                          >
                            <TableCell className="px-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{policy.displayName}</TableCell>
                            <TableCell>{stateBadge(policy.state)}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[250px] truncate">
                              {summarizeConditions(policy.conditions)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {summarizeGrantControls(policy.grantControls)}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {policy.createdDateTime
                                ? formatDistanceToNow(new Date(policy.createdDateTime), {
                                    addSuffix: true,
                                  })
                                : "--"}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {policy.modifiedDateTime
                                ? formatDistanceToNow(new Date(policy.modifiedDateTime), {
                                    addSuffix: true,
                                  })
                                : "--"}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 px-6 py-4">
                                <PolicyDetail
                                  policy={policy}
                                  locationMap={locationMap}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
