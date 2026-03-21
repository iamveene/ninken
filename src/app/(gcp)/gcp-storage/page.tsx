"use client"

import { useState, useEffect } from "react"
import { useGcpStorageBuckets, useGcpStorageObjects } from "@/hooks/use-gcp-key"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  HardDrive,
  Search,
  Folder,
  FileIcon,
  ArrowLeft,
  ChevronRight,
} from "lucide-react"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export default function GcpStoragePage() {
  const [projectId, setProjectId] = useState("")
  const [search, setSearch] = useState("")
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [currentPrefix, setCurrentPrefix] = useState("")

  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) setProjectId(stored)
  }, [])

  const handleProjectChange = (v: string) => {
    setProjectId(v)
    if (v) sessionStorage.setItem(PROJECT_ID_KEY, v)
    else sessionStorage.removeItem(PROJECT_ID_KEY)
    setSelectedBucket(null)
    setCurrentPrefix("")
  }

  const {
    buckets, loading: bucketsLoading, error: bucketsError, refetch: refetchBuckets,
  } = useGcpStorageBuckets(projectId || undefined)

  const {
    objects, prefixes, loading: objectsLoading, error: objectsError, refetch: refetchObjects,
  } = useGcpStorageObjects(
    selectedBucket ?? undefined,
    currentPrefix || undefined,
  )

  const filteredBuckets = buckets.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleBucketClick = (bucketName: string) => {
    setSelectedBucket(bucketName)
    setCurrentPrefix("")
    setSearch("")
  }

  const handlePrefixClick = (prefix: string) => {
    setCurrentPrefix(prefix)
  }

  const handleBack = () => {
    if (currentPrefix) {
      const parts = currentPrefix.split("/").filter(Boolean)
      parts.pop()
      setCurrentPrefix(parts.length > 0 ? parts.join("/") + "/" : "")
    } else {
      setSelectedBucket(null)
      setCurrentPrefix("")
    }
  }

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Cloud Storage
        </h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Enter a GCP project ID to browse Cloud Storage buckets.
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

  // Object browser
  if (selectedBucket) {
    const breadcrumbs = currentPrefix.split("/").filter(Boolean)

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 px-2">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                {selectedBucket}
              </h1>
            </div>
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-9">
                <button
                  onClick={() => setCurrentPrefix("")}
                  className="hover:text-primary transition-colors"
                >
                  root
                </button>
                {breadcrumbs.map((part, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <button
                      onClick={() => setCurrentPrefix(breadcrumbs.slice(0, i + 1).join("/") + "/")}
                      className="hover:text-primary transition-colors"
                    >
                      {part}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <ExportButton
            data={objects as unknown as Record<string, unknown>[]}
            filename={`gcs-${selectedBucket}`}
            columns={["name", "size", "contentType", "updated"]}
          />
        </div>

        {objectsError && <ServiceError error={objectsError} onRetry={refetchObjects} />}

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs text-right">Size</TableHead>
                <TableHead className="text-xs">Content Type</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <>
                  {prefixes.map((prefix) => (
                    <TableRow
                      key={prefix}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handlePrefixClick(prefix)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-medium">{prefix.replace(currentPrefix, "")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">-</TableCell>
                      <TableCell className="text-xs text-muted-foreground">-</TableCell>
                      <TableCell className="text-xs text-muted-foreground">-</TableCell>
                    </TableRow>
                  ))}
                  {objects.map((obj) => (
                    <TableRow key={obj.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">{obj.name.replace(currentPrefix, "")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {obj.size ? formatBytes(Number(obj.size)) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px]">
                          {obj.contentType ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {obj.updated ? new Date(obj.updated).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {prefixes.length === 0 && objects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                        No objects found in this path
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Bucket list
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Cloud Storage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project: {projectId} &middot; {buckets.length} bucket{buckets.length !== 1 ? "s" : ""}
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
            data={filteredBuckets as unknown as Record<string, unknown>[]}
            filename="gcs-buckets"
            columns={["name", "location", "storageClass", "timeCreated"]}
          />
        </div>
      </div>

      {bucketsError && <ServiceError error={bucketsError} onRetry={refetchBuckets} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search buckets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Bucket Name</TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-xs">Storage Class</TableHead>
              <TableHead className="text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bucketsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredBuckets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No buckets found
                </TableCell>
              </TableRow>
            ) : (
              filteredBuckets.map((bucket) => (
                <TableRow
                  key={bucket.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleBucketClick(bucket.name)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">{bucket.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bucket.location ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px]">
                      {bucket.storageClass ?? "STANDARD"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {bucket.timeCreated ? new Date(bucket.timeCreated).toLocaleDateString() : "-"}
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
