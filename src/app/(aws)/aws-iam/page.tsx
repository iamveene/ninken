"use client"

import { useState } from "react"
import {
  useAwsIamUsers,
  useAwsIamRoles,
  useAwsIamPolicies,
  useAwsIamGroups,
} from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Shield, Search, Key, Users, FileText, FolderOpen } from "lucide-react"

type IamTab = "users" | "roles" | "policies" | "groups"

export default function AwsIamPage() {
  const [tab, setTab] = useState<IamTab>("users")
  const [search, setSearch] = useState("")

  const { users, loading: usersLoading, error: usersError, refetch: refetchUsers } = useAwsIamUsers()
  const { roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useAwsIamRoles()
  const { policies, loading: policiesLoading, error: policiesError, refetch: refetchPolicies } = useAwsIamPolicies()
  const { groups, loading: groupsLoading, error: groupsError, refetch: refetchGroups } = useAwsIamGroups()

  const tabs: { id: IamTab; label: string; count: number }[] = [
    { id: "users", label: "Users", count: users.length },
    { id: "roles", label: "Roles", count: roles.length },
    { id: "policies", label: "Policies", count: policies.length },
    { id: "groups", label: "Groups", count: groups.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            IAM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identity and Access Management
          </p>
        </div>
        <ExportButton
          data={
            tab === "users"
              ? (users as unknown as Record<string, unknown>[])
              : tab === "roles"
                ? (roles as unknown as Record<string, unknown>[])
                : tab === "policies"
                  ? (policies as unknown as Record<string, unknown>[])
                  : (groups as unknown as Record<string, unknown>[])
          }
          filename={`aws-iam-${tab}`}
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch("") }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">
              {t.count}
            </Badge>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <>
          {usersError && <ServiceError error={usersError} onRetry={refetchUsers} />}
          <UsersTable
            users={users.filter((u) =>
              !search || u.userName.toLowerCase().includes(search.toLowerCase())
            )}
            loading={usersLoading}
          />
        </>
      )}

      {/* Roles tab */}
      {tab === "roles" && (
        <>
          {rolesError && <ServiceError error={rolesError} onRetry={refetchRoles} />}
          <RolesTable
            roles={roles.filter((r) =>
              !search || r.roleName.toLowerCase().includes(search.toLowerCase())
            )}
            loading={rolesLoading}
          />
        </>
      )}

      {/* Policies tab */}
      {tab === "policies" && (
        <>
          {policiesError && <ServiceError error={policiesError} onRetry={refetchPolicies} />}
          <PoliciesTable
            policies={policies.filter((p) =>
              !search || p.policyName.toLowerCase().includes(search.toLowerCase())
            )}
            loading={policiesLoading}
          />
        </>
      )}

      {/* Groups tab */}
      {tab === "groups" && (
        <>
          {groupsError && <ServiceError error={groupsError} onRetry={refetchGroups} />}
          <GroupsTable
            groups={groups.filter((g) =>
              !search || g.groupName.toLowerCase().includes(search.toLowerCase())
            )}
            loading={groupsLoading}
          />
        </>
      )}
    </div>
  )
}

function UsersTable({ users, loading }: {
  users: ReturnType<typeof useAwsIamUsers>["users"]
  loading: boolean
}) {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Username</TableHead>
            <TableHead className="text-xs">ARN</TableHead>
            <TableHead className="text-xs">Access Keys</TableHead>
            <TableHead className="text-xs">Created</TableHead>
            <TableHead className="text-xs">Last Login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{user.userName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">{user.arn}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {user.accessKeys.map((k) => (
                      <Badge
                        key={k.accessKeyId}
                        variant="outline"
                        className={`text-[9px] ${
                          k.status === "Active"
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        <Key className="h-2.5 w-2.5 mr-0.5" />
                        {k.accessKeyId.slice(-4)}
                      </Badge>
                    ))}
                    {user.accessKeys.length === 0 && (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(user.createDate).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {user.passwordLastUsed ? new Date(user.passwordLastUsed).toLocaleDateString() : "Never"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RolesTable({ roles, loading }: {
  roles: ReturnType<typeof useAwsIamRoles>["roles"]
  loading: boolean
}) {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Role Name</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Max Session</TableHead>
            <TableHead className="text-xs">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : roles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                No roles found
              </TableCell>
            </TableRow>
          ) : (
            roles.map((role) => (
              <TableRow key={role.roleId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{role.roleName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground line-clamp-1">{role.description ?? "-"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{Math.round(role.maxSessionDuration / 3600)}h</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(role.createDate).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PoliciesTable({ policies, loading }: {
  policies: ReturnType<typeof useAwsIamPolicies>["policies"]
  loading: boolean
}) {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Policy Name</TableHead>
            <TableHead className="text-xs">Attachments</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : policies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                No customer-managed policies found
              </TableCell>
            </TableRow>
          ) : (
            policies.map((policy) => (
              <TableRow key={policy.policyId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{policy.policyName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[9px]">{policy.attachmentCount}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground line-clamp-1">{policy.description ?? "-"}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(policy.updateDate).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function GroupsTable({ groups, loading }: {
  groups: ReturnType<typeof useAwsIamGroups>["groups"]
  loading: boolean
}) {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Group Name</TableHead>
            <TableHead className="text-xs">ARN</TableHead>
            <TableHead className="text-xs">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 3 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                No groups found
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <TableRow key={group.groupId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{group.groupName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[250px] block">{group.arn}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(group.createDate).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
