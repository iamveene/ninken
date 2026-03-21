"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Search, AlertCircle, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useBuckets, useProjects, type Bucket } from "@/hooks/use-buckets"

type BucketListProps = {
  onSelect: (bucket: Bucket) => void
}

export function BucketList({ onSelect }: BucketListProps) {
  const {
    projects,
    loading: projectsLoading,
    selectedProject,
    setSelectedProject,
    permissionDenied,
  } = useProjects()
  const [manualProject, setManualProject] = useState("")
  const [submittedManualProject, setSubmittedManualProject] = useState("")

  const useManualInput = permissionDenied || (projects.length === 0 && !projectsLoading)
  const activeProject = useManualInput ? submittedManualProject : selectedProject
  const { buckets, loading, error } = useBuckets(activeProject)

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittedManualProject(manualProject.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      {useManualInput ? (
        <div className="flex flex-col gap-4">
          {permissionDenied && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Could not load projects automatically
                </CardTitle>
                <CardDescription>
                  Enter a project ID manually below to browse its Cloud Storage buckets.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <Input
              placeholder="Enter GCP Project ID"
              value={manualProject}
              onChange={(e) => setManualProject(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" disabled={!manualProject.trim()}>
              <Search className="h-4 w-4 mr-1.5" />
              List Buckets
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v ?? "")}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select a project"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.projectId} value={p.projectId}>
                  {p.displayName || p.projectId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProject && (
            <span className="text-sm text-muted-foreground">{selectedProject}</span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : activeProject && buckets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-lg font-medium">No buckets found</p>
          <p className="text-sm text-muted-foreground">
            No storage buckets found in project "{activeProject}"
          </p>
        </div>
      ) : buckets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Storage Class</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow
                key={bucket.name}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(bucket)}
              >
                <TableCell className="font-medium">{bucket.name}</TableCell>
                <TableCell className="text-muted-foreground">{bucket.location}</TableCell>
                <TableCell className="text-muted-foreground">{bucket.storageClass}</TableCell>
                <TableCell className="text-muted-foreground">
                  {bucket.timeCreated
                    ? formatDistanceToNow(new Date(bucket.timeCreated), { addSuffix: true })
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : !activeProject ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-lg font-medium">No project selected</p>
            <p className="text-sm text-muted-foreground">
              Select or enter a GCP project ID to browse its Cloud Storage buckets.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
