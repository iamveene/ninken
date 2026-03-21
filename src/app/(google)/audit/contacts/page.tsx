"use client"

import { useState, useMemo } from "react"
import {
  Search,
  ContactRound,
  ShieldAlert,
  AlertCircle,
  Building2,
} from "lucide-react"
import {
  useAuditContacts,
  type ContactPerson,
  type ContactSource,
} from "@/hooks/use-audit-contacts"
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { ExportButton } from "@/components/layout/export-button"

const SOURCE_TABS: {
  key: ContactSource
  label: string
  description: string
}[] = [
  {
    key: "directory",
    label: "Directory",
    description: "Domain profiles from the organization directory",
  },
  {
    key: "contacts",
    label: "My Contacts",
    description: "Personal contacts of the authenticated user",
  },
  {
    key: "other",
    label: "Other Contacts",
    description: "Auto-saved contacts from interactions",
  },
]

function matchesSearch(person: ContactPerson, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    person.displayName.toLowerCase().includes(q) ||
    person.emails.some((e) => e.toLowerCase().includes(q)) ||
    person.phones.some((p) => p.includes(q)) ||
    (person.organization?.name?.toLowerCase().includes(q) ?? false) ||
    (person.organization?.title?.toLowerCase().includes(q) ?? false)
  )
}

function contactsToExportRows(
  contacts: ContactPerson[]
): Record<string, unknown>[] {
  return contacts.map((c) => ({
    displayName: c.displayName,
    emails: c.emails.join("; "),
    phones: c.phones.join("; "),
    organization: c.organization?.name ?? "",
    title: c.organization?.title ?? "",
    department: c.organization?.department ?? "",
    source: c.source,
    resourceName: c.resourceName,
  }))
}

export default function ContactsAuditPage() {
  const [activeSource, setActiveSource] = useState<ContactSource>("directory")
  const [search, setSearch] = useState("")

  const { contacts, scope, loading, error } = useAuditContacts(activeSource)

  const filteredContacts = useMemo(
    () => contacts.filter((c) => matchesSearch(c, search)),
    [contacts, search]
  )

  const exportRows = useMemo(
    () => contactsToExportRows(filteredContacts),
    [filteredContacts]
  )

  const isDenied = scope === "denied"

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorized")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Contacts Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enumerate organization directory, personal contacts, and
            auto-saved contacts for social engineering preparation.
          </p>
        </div>
        <ExportButton
          data={exportRows}
          filename={`contacts-${activeSource}`}
          disabled={loading || filteredContacts.length === 0}
        />
      </div>

      {/* Source tabs */}
      <div className="flex gap-1">
        {SOURCE_TABS.map((tab) => {
          const isActive = activeSource === tab.key
          const isSourceDenied =
            !loading && isActive && isDenied
          return (
            <TooltipProvider key={tab.key}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setActiveSource(tab.key)
                        setSearch("")
                      }}
                      className={
                        isSourceDenied
                          ? "opacity-70"
                          : undefined
                      }
                    >
                      {tab.label}
                      {!loading && isActive && !isDenied && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {contacts.length}
                        </span>
                      )}
                      {isSourceDenied && (
                        <ShieldAlert className="ml-1 h-3 w-3 text-amber-500" />
                      )}
                    </Button>
                  }
                />
                <TooltipContent>{tab.description}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>

      {/* Denied state */}
      {!loading && isDenied && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Access denied for {activeSource} source. The token lacks the
            required scope. Try a different source tab.
          </span>
        </div>
      )}

      {/* Error state */}
      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError
                  ? "Access denied"
                  : "Unable to load contacts"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "The required People API scopes are not granted for this token."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          {!loading && !isDenied && contacts.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {contacts.length}
              </span>{" "}
              contacts from{" "}
              <span className="font-medium text-foreground">
                {activeSource}
              </span>{" "}
              source
            </div>
          )}

          {/* Search */}
          {!isDenied && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, org..."
                className="pl-9"
              />
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : !isDenied && contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <ContactRound className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No contacts found</p>
              <p className="text-sm text-muted-foreground">
                No contacts were returned from the {activeSource} source.
              </p>
            </div>
          ) : !isDenied ? (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Emails</TableHead>
                    <TableHead>Phones</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No contacts match the current search.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((person) => (
                      <TableRow key={person.resourceName}>
                        <TableCell className="font-medium">
                          {person.displayName || "--"}
                        </TableCell>
                        <TableCell>
                          {person.emails.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {person.emails.map((email, i) => (
                                <span
                                  key={i}
                                  className="text-sm text-muted-foreground"
                                >
                                  {email}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.phones.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {person.phones.map((phone, i) => (
                                <span
                                  key={i}
                                  className="font-mono text-xs text-muted-foreground"
                                >
                                  {phone}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.organization ? (
                            <Tooltip>
                              <TooltipTrigger className="cursor-default">
                                <Badge
                                  variant="outline"
                                  className="gap-1 max-w-[200px] truncate"
                                >
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {person.organization.name || "--"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <p>
                                    Org: {person.organization.name || "N/A"}
                                  </p>
                                  {person.organization.department && (
                                    <p>
                                      Dept:{" "}
                                      {person.organization.department}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {person.organization?.title || "--"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          ) : null}
        </>
      )}
    </div>
  )
}
