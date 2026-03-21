"use client"

import { useState, useEffect } from "react"
import { useGcpRtdbInstances, useGcpRtdbData } from "@/hooks/use-gcp-key"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Zap,
  ChevronRight,
  ArrowLeft,
  Folder,
  FileText,
} from "lucide-react"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

function RtdbTreeNode({
  nodeKey,
  value,
  onNavigate,
}: {
  nodeKey: string
  value: unknown
  onNavigate: (path: string) => void
}) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value)
  const isArray = Array.isArray(value)

  if (isObject || isArray) {
    const entries = isArray
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    const count = entries.length

    return (
      <div className="border-l border-muted pl-3 ml-1">
        <button
          onClick={() => onNavigate(nodeKey)}
          className="flex items-center gap-1.5 py-1 text-xs hover:text-primary transition-colors"
        >
          <Folder className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="font-medium">{nodeKey}</span>
          <Badge variant="secondary" className="text-[9px] ml-1">
            {count} {isArray ? "items" : "keys"}
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-l border-muted pl-3 ml-1">
      <div className="flex items-center gap-1.5 py-1 text-xs">
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">{nodeKey}:</span>
        <span className="font-mono truncate">
          {value === null ? "null" : String(value)}
        </span>
      </div>
    </div>
  )
}

export default function GcpRtdbPage() {
  const [projectId, setProjectId] = useState("")
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState("/")

  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) setProjectId(stored)
  }, [])

  const handleProjectChange = (v: string) => {
    setProjectId(v)
    if (v) sessionStorage.setItem(PROJECT_ID_KEY, v)
    else sessionStorage.removeItem(PROJECT_ID_KEY)
    setSelectedInstance(null)
    setCurrentPath("/")
  }

  const {
    instances, loading: instLoading, error: instError, refetch: refetchInst,
  } = useGcpRtdbInstances(projectId || undefined)

  const {
    data: rtdbData, loading: dataLoading, error: dataError, refetch: refetchData,
  } = useGcpRtdbData(
    selectedInstance ?? undefined,
    currentPath,
  )

  const handleNavigate = (key: string) => {
    const newPath = currentPath === "/" ? `/${key}` : `${currentPath}/${key}`
    setCurrentPath(newPath)
  }

  const handleBack = () => {
    if (currentPath === "/") {
      setSelectedInstance(null)
    } else {
      const parts = currentPath.split("/").filter(Boolean)
      parts.pop()
      setCurrentPath(parts.length > 0 ? "/" + parts.join("/") : "/")
    }
  }

  const breadcrumbs = currentPath.split("/").filter(Boolean)

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Realtime Database
        </h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Enter a GCP project ID to browse RTDB instances.
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

  // Instance list
  if (!selectedInstance) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Realtime Database
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Project: {projectId} &middot; {instances.length} instance{instances.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Input
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            placeholder="Project ID"
            className="h-8 text-xs font-mono w-64"
          />
        </div>

        {instError && <ServiceError error={instError} onRetry={refetchInst} />}

        {instLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : instances.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              No RTDB instances found for this project.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {instances.map((inst) => {
              const instanceName = inst.name?.split("/").pop() ?? inst.name
              return (
                <Card
                  key={inst.name}
                  className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
                  onClick={() => {
                    setSelectedInstance(instanceName)
                    setCurrentPath("/")
                  }}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <Zap className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{instanceName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {inst.databaseUrl}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">
                      {inst.state ?? "ACTIVE"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Data browser
  const dataEntries = rtdbData !== null && typeof rtdbData === "object" && !Array.isArray(rtdbData)
    ? Object.entries(rtdbData as Record<string, unknown>)
    : Array.isArray(rtdbData)
    ? rtdbData.map((v, i) => [String(i), v] as [string, unknown])
    : []

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 px-2">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {selectedInstance}
        </h1>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          onClick={() => setCurrentPath("/")}
          className="hover:text-primary transition-colors"
        >
          root
        </button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => setCurrentPath("/" + breadcrumbs.slice(0, i + 1).join("/"))}
              className="hover:text-primary transition-colors"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {dataError && <ServiceError error={dataError} onRetry={refetchData} />}

      {dataLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : rtdbData === null ? (
        <Card>
          <CardContent className="p-4 text-center text-xs text-muted-foreground">
            No data at this path.
          </CardContent>
        </Card>
      ) : typeof rtdbData !== "object" ? (
        // Scalar value
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-mono">{String(rtdbData)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border p-3 space-y-1">
          {dataEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Empty object</p>
          ) : (
            dataEntries.map(([key, value]) => (
              <RtdbTreeNode
                key={key}
                nodeKey={key}
                value={value}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
