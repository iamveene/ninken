"use client"

import { useState, useMemo } from "react"
import {
  Search,
  KeyRound,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react"
import { useAuthenticationMethods } from "@/hooks/use-m365-audit"
import type { AuthMethodUser, AuthMethod, AuthMethodAggregate } from "@/hooks/use-m365-audit"
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

// ---- Method type constants ------------------------------------------------

const METHOD_PASSWORD = "#microsoft.graph.passwordAuthenticationMethod"
const METHOD_PHONE = "#microsoft.graph.phoneAuthenticationMethod"
const METHOD_FIDO2 = "#microsoft.graph.fido2AuthenticationMethod"
const METHOD_AUTHENTICATOR = "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod"
const METHOD_EMAIL = "#microsoft.graph.emailAuthenticationMethod"
const METHOD_SOFTWARE_OATH = "#microsoft.graph.softwareOathAuthenticationMethod"
const METHOD_TAP = "#microsoft.graph.temporaryAccessPassAuthenticationMethod"
const METHOD_WINDOWS_HELLO = "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod"

function methodLabel(odataType: string): string {
  switch (odataType) {
    case METHOD_PASSWORD:
      return "Password"
    case METHOD_PHONE:
      return "Phone"
    case METHOD_FIDO2:
      return "FIDO2"
    case METHOD_AUTHENTICATOR:
      return "Authenticator"
    case METHOD_EMAIL:
      return "Email"
    case METHOD_SOFTWARE_OATH:
      return "Software OATH"
    case METHOD_TAP:
      return "Temporary Access Pass"
    case METHOD_WINDOWS_HELLO:
      return "Windows Hello"
    default:
      return odataType.replace("#microsoft.graph.", "").replace("AuthenticationMethod", "")
  }
}

function methodBadgeVariant(odataType: string): "default" | "secondary" | "outline" | "destructive" {
  switch (odataType) {
    case METHOD_FIDO2:
      return "default"
    case METHOD_AUTHENTICATOR:
      return "default"
    case METHOD_PASSWORD:
      return "outline"
    case METHOD_PHONE:
      return "secondary"
    default:
      return "outline"
  }
}

// ---- Aggregate helpers ----------------------------------------------------

function hasMethodType(methods: AuthMethod[], type: string): boolean {
  return methods.some((m) => m.odataType === type)
}

function computeAggregate(users: AuthMethodUser[]): AuthMethodAggregate {
  let passwordOnly = 0
  let phoneOnlyMfa = 0
  let fido2 = 0
  let microsoftAuthenticator = 0
  let phone = 0
  let email = 0
  let softwareOath = 0
  let temporaryAccessPass = 0
  let windowsHello = 0

  for (const user of users) {
    const m = user.methods
    if (hasMethodType(m, METHOD_FIDO2)) fido2++
    if (hasMethodType(m, METHOD_AUTHENTICATOR)) microsoftAuthenticator++
    if (hasMethodType(m, METHOD_PHONE)) phone++
    if (hasMethodType(m, METHOD_EMAIL)) email++
    if (hasMethodType(m, METHOD_SOFTWARE_OATH)) softwareOath++
    if (hasMethodType(m, METHOD_TAP)) temporaryAccessPass++
    if (hasMethodType(m, METHOD_WINDOWS_HELLO)) windowsHello++

    // Password-only: only has password method, no other MFA
    const nonPassword = m.filter((x) => x.odataType !== METHOD_PASSWORD)
    if (nonPassword.length === 0 && m.length > 0) {
      passwordOnly++
    }

    // Phone-only MFA: has phone but no FIDO2, authenticator, windows hello, or software OATH
    if (
      hasMethodType(m, METHOD_PHONE) &&
      !hasMethodType(m, METHOD_FIDO2) &&
      !hasMethodType(m, METHOD_AUTHENTICATOR) &&
      !hasMethodType(m, METHOD_WINDOWS_HELLO) &&
      !hasMethodType(m, METHOD_SOFTWARE_OATH)
    ) {
      phoneOnlyMfa++
    }
  }

  return {
    total: users.length,
    passwordOnly,
    phoneOnlyMfa,
    fido2,
    microsoftAuthenticator,
    phone,
    email,
    softwareOath,
    temporaryAccessPass,
    windowsHello,
  }
}

// ---- Filter types ---------------------------------------------------------

type FilterKey = "all" | "passwordOnly" | "phoneOnlyMfa" | "fido2" | "authenticator" | "noMfa"

function matchesFilter(user: AuthMethodUser, filter: FilterKey): boolean {
  const m = user.methods
  switch (filter) {
    case "passwordOnly": {
      const nonPassword = m.filter((x) => x.odataType !== METHOD_PASSWORD)
      return nonPassword.length === 0 && m.length > 0
    }
    case "phoneOnlyMfa":
      return (
        hasMethodType(m, METHOD_PHONE) &&
        !hasMethodType(m, METHOD_FIDO2) &&
        !hasMethodType(m, METHOD_AUTHENTICATOR) &&
        !hasMethodType(m, METHOD_WINDOWS_HELLO) &&
        !hasMethodType(m, METHOD_SOFTWARE_OATH)
      )
    case "fido2":
      return hasMethodType(m, METHOD_FIDO2)
    case "authenticator":
      return hasMethodType(m, METHOD_AUTHENTICATOR)
    case "noMfa": {
      // No MFA at all: no FIDO2, no authenticator, no phone, no windows hello, no software oath
      return (
        !hasMethodType(m, METHOD_FIDO2) &&
        !hasMethodType(m, METHOD_AUTHENTICATOR) &&
        !hasMethodType(m, METHOD_PHONE) &&
        !hasMethodType(m, METHOD_WINDOWS_HELLO) &&
        !hasMethodType(m, METHOD_SOFTWARE_OATH)
      )
    }
    default:
      return true
  }
}

function matchesSearch(user: AuthMethodUser, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    user.displayName?.toLowerCase().includes(q) ||
    user.userPrincipalName?.toLowerCase().includes(q) ||
    false
  )
}

// ---- Component ------------------------------------------------------------

export default function AuthMethodsPage() {
  const { users, scope, loading, error } = useAuthenticationMethods()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

  const aggregate = useMemo(() => computeAggregate(users), [users])

  const filtered = useMemo(
    () => users.filter((u) => matchesFilter(u, activeFilter) && matchesSearch(u, search)),
    [users, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: aggregate.total },
    { key: "passwordOnly", label: "Password Only", count: aggregate.passwordOnly },
    { key: "phoneOnlyMfa", label: "Phone-only MFA", count: aggregate.phoneOnlyMfa },
    { key: "fido2", label: "FIDO2", count: aggregate.fido2 },
    { key: "authenticator", label: "Authenticator", count: aggregate.microsoftAuthenticator },
    { key: "noMfa", label: "No MFA", count: undefined },
  ]

  const exportData = filtered.map((u) => ({
    displayName: u.displayName,
    userPrincipalName: u.userPrincipalName,
    methodCount: u.methods.length,
    methods: u.methods.map((m) => methodLabel(m.odataType)).join(", "),
    hasPassword: hasMethodType(u.methods, METHOD_PASSWORD),
    hasPhone: hasMethodType(u.methods, METHOD_PHONE),
    hasFido2: hasMethodType(u.methods, METHOD_FIDO2),
    hasAuthenticator: hasMethodType(u.methods, METHOD_AUTHENTICATOR),
    hasWindowsHello: hasMethodType(u.methods, METHOD_WINDOWS_HELLO),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Authentication Methods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-user MFA method inventory. Identify users with weak authentication configurations
            such as password-only or phone-only MFA.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-auth-methods"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {/* OPSEC Warning */}
      {!loading && !error && scope === "tenant" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-amber-600">OPSEC:</span>{" "}
              Enumerating all users&apos; auth methods is a high-signal admin action that may be logged and audited.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scope indicator: me-only fallback */}
      {!loading && !error && scope === "me" && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Admin scope not available; showing current user only.
              Directory read permissions are required to enumerate all users.
            </p>
          </CardContent>
        </Card>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load authentication methods"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "UserAuthenticationMethod.Read.All permission is required to enumerate authentication methods."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aggregate stat cards */}
          {!loading && users.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{aggregate.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Password Only</p>
                  <p className={`text-2xl font-bold ${aggregate.passwordOnly > 0 ? "text-destructive" : ""}`}>
                    {aggregate.passwordOnly}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Phone-only MFA</p>
                  <p className={`text-2xl font-bold ${aggregate.phoneOnlyMfa > 0 ? "text-amber-500" : ""}`}>
                    {aggregate.phoneOnlyMfa}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">FIDO2</p>
                  <p className="text-2xl font-bold">{aggregate.fido2}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Authenticator</p>
                  <p className="text-2xl font-bold">{aggregate.microsoftAuthenticator}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search + filter tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or UPN..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  variant={activeFilter === f.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(f.key)}
                >
                  {f.label}
                  {!loading && f.count !== undefined && (
                    <span className="ml-1 text-xs text-muted-foreground">{f.count}</span>
                  )}
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
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <KeyRound className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No authentication methods found</p>
              <p className="text-sm text-muted-foreground">
                Could not retrieve authentication methods for any users.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Methods</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No users match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((user) => {
                      const isExpanded = expandedIds.has(user.id)
                      return (
                        <UserRow
                          key={user.id}
                          user={user}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpanded(user.id)}
                        />
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

// ---- User row sub-component -----------------------------------------------

function UserRow({
  user,
  isExpanded,
  onToggle,
}: {
  user: AuthMethodUser
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="px-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{user.displayName}</TableCell>
        <TableCell className="text-muted-foreground">{user.userPrincipalName}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {user.methods.map((m) => (
              <Badge key={m.id} variant={methodBadgeVariant(m.odataType)}>
                {methodLabel(m.odataType)}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-center text-muted-foreground">{user.methods.length}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 px-6 py-4">
            <MethodDetails methods={user.methods} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ---- Expanded method details -----------------------------------------------

function MethodDetails({ methods }: { methods: AuthMethod[] }) {
  if (methods.length === 0) {
    return <p className="text-sm text-muted-foreground">No authentication methods registered.</p>
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium mb-2">Registered Methods</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {methods.map((m) => (
          <div key={m.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <Badge variant={methodBadgeVariant(m.odataType)}>
                {methodLabel(m.odataType)}
              </Badge>
              {m.createdDateTime && (
                <span className="text-xs text-muted-foreground">
                  {new Date(m.createdDateTime).toLocaleDateString()}
                </span>
              )}
            </div>
            {m.displayName && (
              <p className="mt-1 text-muted-foreground">{m.displayName}</p>
            )}
            {m.phoneNumber && (
              <p className="mt-1 text-muted-foreground">
                {m.phoneNumber} {m.phoneType ? `(${m.phoneType})` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
