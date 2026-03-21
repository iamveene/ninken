"use client"

import { useState } from "react"
import { useAwsSecrets } from "@/hooks/use-aws"
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
import { KeyRound, Search, Eye, RotateCw, CheckCircle2, XCircle } from "lucide-react"

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
]

export default function AwsSecretsPage() {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState<string | undefined>(undefined)
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string | null>>({})
  const [loadingSecret, setLoadingSecret] = useState<string | null>(null)

  const { secrets, loading, error, refetch } = useAwsSecrets(region)

  const filtered = secrets.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleRevealSecret = async (secretName: string) => {
    if (revealedSecrets[secretName] !== undefined) {
      // Toggle off
      setRevealedSecrets((prev) => {
        const next = { ...prev }
        delete next[secretName]
        return next
      })
      return
    }

    setLoadingSecret(secretName)
    try {
      const params = new URLSearchParams({ secretId: secretName })
      if (region) params.set("region", region)
      const res = await fetch(`/api/aws/secrets/value?${params}`)
      if (!res.ok) throw new Error("Failed to retrieve secret")
      const data = await res.json()
      setRevealedSecrets((prev) => ({ ...prev, [secretName]: data.secretString ?? "[binary]" }))
    } catch {
      setRevealedSecrets((prev) => ({ ...prev, [secretName]: "[error retrieving secret]" }))
    } finally {
      setLoadingSecret(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Secrets Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {secrets.length} secrets found
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="aws-secrets"
          columns={["name", "arn", "description", "rotationEnabled", "lastChangedDate", "lastRotatedDate"]}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search secrets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={region ?? ""}
          onChange={(e) => setRegion(e.target.value || undefined)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Default Region</option>
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Secret Name</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Rotation</TableHead>
              <TableHead className="text-xs">Last Changed</TableHead>
              <TableHead className="text-xs">Last Rotated</TableHead>
              <TableHead className="text-xs w-24">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No secrets found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((secret) => (
                <TableRow key={secret.arn}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{secret.name}</span>
                      </div>
                      {secret.tags.length > 0 && (
                        <div className="flex gap-1 ml-5.5">
                          {secret.tags.slice(0, 2).map((t) => (
                            <Badge key={t.key} variant="secondary" className="text-[8px] px-1 py-0">
                              {t.key}={t.value}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {secret.description ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {secret.rotationEnabled ? (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                        <RotateCw className="h-2.5 w-2.5 mr-0.5" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-neutral-500/30 text-neutral-400">
                        Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {secret.lastChangedDate ? new Date(secret.lastChangedDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {secret.lastRotatedDate ? new Date(secret.lastRotatedDate).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    {revealedSecrets[secret.name] !== undefined ? (
                      <div className="flex flex-col gap-1">
                        <pre className="text-[10px] font-mono bg-muted p-1 rounded max-w-[200px] overflow-auto max-h-[80px]">
                          {revealedSecrets[secret.name]}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[9px] text-muted-foreground"
                          onClick={() => handleRevealSecret(secret.name)}
                        >
                          Hide
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => handleRevealSecret(secret.name)}
                        disabled={loadingSecret === secret.name}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {loadingSecret === secret.name ? "..." : "Retrieve"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
