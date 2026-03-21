"use client"

import { useState, useEffect } from "react"
import { useGcpVertexModels, useGcpVertexEndpoints } from "@/hooks/use-gcp-key"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Brain, Search } from "lucide-react"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

const REGIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west4",
  "europe-west1",
  "europe-west2",
  "europe-west4",
  "asia-east1",
  "asia-northeast1",
  "asia-southeast1",
  "northamerica-northeast1",
]

type VertexTab = "models" | "endpoints"

export default function GcpVertexAiPage() {
  const [projectId, setProjectId] = useState("")
  const [region, setRegion] = useState("us-central1")
  const [tab, setTab] = useState<VertexTab>("models")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) setProjectId(stored)
  }, [])

  const handleProjectChange = (v: string) => {
    setProjectId(v)
    if (v) sessionStorage.setItem(PROJECT_ID_KEY, v)
    else sessionStorage.removeItem(PROJECT_ID_KEY)
  }

  const {
    models, loading: modelsLoading, error: modelsError, refetch: refetchModels,
  } = useGcpVertexModels(projectId || undefined, region)

  const {
    endpoints, loading: endpointsLoading, error: endpointsError, refetch: refetchEndpoints,
  } = useGcpVertexEndpoints(projectId || undefined, region)

  const tabs: { id: VertexTab; label: string; count: number }[] = [
    { id: "models", label: "Models", count: models.length },
    { id: "endpoints", label: "Endpoints", count: endpoints.length },
  ]

  const filteredModels = models.filter((m) =>
    !search || (m.displayName ?? m.name ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const filteredEndpoints = endpoints.filter((e) =>
    !search || (e.displayName ?? e.name ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Vertex AI
        </h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Enter a GCP project ID to explore Vertex AI models and endpoints.
            </p>
            <Input
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              placeholder="Enter GCP project ID"
              className="h-8 text-xs font-mono"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Vertex AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project: {projectId} &middot; Region: {region}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            placeholder="Project ID"
            className="h-8 text-xs font-mono w-48"
          />
          <ExportButton
            data={
              tab === "models"
                ? (models as unknown as Record<string, unknown>[])
                : (endpoints as unknown as Record<string, unknown>[])
            }
            filename={`gcp-vertexai-${tab}`}
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-4 border-b">
        <div className="flex gap-1">
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
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">{t.count}</Badge>
            </button>
          ))}
        </div>
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
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Models tab */}
      {tab === "models" && (
        <>
          {modelsError && <ServiceError error={modelsError} onRetry={refetchModels} />}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Display Name</TableHead>
                  <TableHead className="text-xs">Resource Name</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                      No models found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModels.map((model) => (
                    <TableRow key={model.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{model.displayName ?? "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[300px]">
                        {model.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {model.createTime ? new Date(model.createTime).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {model.updateTime ? new Date(model.updateTime).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Endpoints tab */}
      {tab === "endpoints" && (
        <>
          {endpointsError && <ServiceError error={endpointsError} onRetry={refetchEndpoints} />}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Display Name</TableHead>
                  <TableHead className="text-xs">Resource Name</TableHead>
                  <TableHead className="text-xs text-right">Deployed Models</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpointsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredEndpoints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                      No endpoints found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEndpoints.map((ep) => (
                    <TableRow key={ep.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{ep.displayName ?? "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[300px]">
                        {ep.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-[9px]">
                          {ep.deployedModels?.length ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ep.createTime ? new Date(ep.createTime).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
