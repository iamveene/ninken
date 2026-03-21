"use client"

import { useState } from "react"
import { useAwsS3Buckets, useAwsS3Objects } from "@/hooks/use-aws"
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
import {
  Database,
  Search,
  Folder,
  FileIcon,
  Download,
  ArrowLeft,
  ChevronRight,
} from "lucide-react"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export default function AwsS3Page() {
  const [search, setSearch] = useState("")
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [currentPrefix, setCurrentPrefix] = useState<string>("")
  const [bucketRegion, setBucketRegion] = useState<string | undefined>(undefined)

  const { buckets, loading: bucketsLoading, error: bucketsError, refetch: refetchBuckets } = useAwsS3Buckets()
  const { objects, prefixes, loading: objectsLoading, error: objectsError, refetch: refetchObjects } = useAwsS3Objects(
    selectedBucket ?? undefined,
    currentPrefix || undefined,
    bucketRegion,
  )

  const filteredBuckets = buckets.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleBucketClick = (bucketName: string) => {
    setSelectedBucket(bucketName)
    setCurrentPrefix("")
    setBucketRegion(undefined)
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

  const handleDownload = (key: string) => {
    const params = new URLSearchParams({
      bucket: selectedBucket ?? "",
      key,
    })
    if (bucketRegion) params.set("region", bucketRegion)
    window.open(`/api/aws/s3/download?${params}`, "_blank")
  }

  // Object browser view
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
                <Database className="h-5 w-5" />
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
            filename={`s3-${selectedBucket}`}
            columns={["key", "size", "storageClass", "lastModified"]}
          />
        </div>

        {objectsError && <ServiceError error={objectsError} onRetry={refetchObjects} />}

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs text-right">Size</TableHead>
                <TableHead className="text-xs">Storage Class</TableHead>
                <TableHead className="text-xs">Last Modified</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
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
                      <TableCell />
                    </TableRow>
                  ))}
                  {objects.map((obj) => (
                    <TableRow key={obj.key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">{obj.key.replace(currentPrefix, "")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">{formatBytes(obj.size)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px]">{obj.storageClass ?? "STANDARD"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {obj.lastModified ? new Date(obj.lastModified).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleDownload(obj.key)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {prefixes.length === 0 && objects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
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

  // Bucket list view
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            S3 Buckets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {buckets.length} buckets found
          </p>
        </div>
        <ExportButton
          data={filteredBuckets as unknown as Record<string, unknown>[]}
          filename="aws-s3-buckets"
          columns={["name", "creationDate"]}
        />
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
              <TableHead className="text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bucketsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 2 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredBuckets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-8">
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
                      <Database className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">{bucket.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {bucket.creationDate ? new Date(bucket.creationDate).toLocaleDateString() : "-"}
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
