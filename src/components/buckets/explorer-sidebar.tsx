"use client"

import { useState, useCallback, useEffect } from "react"
import {
  ChevronRight,
  ChevronDown,
  Database,
  FolderOpen,
  Folder,
  Loader2,
  AlertCircle,
  Lock,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProjects, useBuckets, type Bucket, type GcpProject } from "@/hooks/use-buckets"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type ExplorerSidebarProps = {
  selectedBucket: Bucket | null
  onSelectBucket: (bucket: Bucket, projectId: string) => void
}

export function ExplorerSidebar({ selectedBucket, onSelectBucket }: ExplorerSidebarProps) {
  const {
    projects,
    loading: projectsLoading,
  } = useProjects()

  const [manualProject, setManualProject] = useState("")
  const [manualProjects, setManualProjects] = useState<string[]>([])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = manualProject.trim()
    if (id && !manualProjects.includes(id) && !projects.some((p) => p.projectId === id)) {
      setManualProjects((prev) => [...prev, id])
    }
    setManualProject("")
  }

  // Manual projects as GcpProject objects (accessible by default, unknown until loaded)
  const manualProjectObjects: GcpProject[] = manualProjects.map((id) => ({
    projectId: id,
    name: id,
    displayName: id,
    accessible: true,
  }))

  // Combine: API projects (already sorted by server) + manual projects
  const allProjects = [...projects, ...manualProjectObjects]

  // Split into accessible and inaccessible
  const accessibleProjects = allProjects.filter((p) => p.accessible !== false)
  const inaccessibleProjects = allProjects.filter((p) => p.accessible === false)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projectsLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading projects...
          </div>
        ) : allProjects.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Add a project ID below to browse its buckets.
          </div>
        ) : (
          <>
            {accessibleProjects.map((project) => (
              <ProjectNode
                key={project.projectId}
                project={project}
                selectedBucket={selectedBucket}
                onSelectBucket={onSelectBucket}
                defaultExpanded={(project.bucketCount ?? 0) > 0}
              />
            ))}

            {inaccessibleProjects.length > 0 && (
              <>
                {accessibleProjects.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      No storage access
                    </p>
                  </div>
                )}
                {inaccessibleProjects.map((project) => (
                  <ProjectNode
                    key={project.projectId}
                    project={project}
                    selectedBucket={selectedBucket}
                    onSelectBucket={onSelectBucket}
                    disabled
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Manual project entry */}
      <div className="border-t p-2 space-y-1.5">
        <form onSubmit={handleManualSubmit} className="flex gap-1">
          <Input
            placeholder="Project ID (e.g. my-project)"
            value={manualProject}
            onChange={(e) => setManualProject(e.target.value)}
            className="h-7 text-xs"
          />
          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!manualProject.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}

function ProjectNode({
  project,
  selectedBucket,
  onSelectBucket,
  defaultExpanded = false,
  disabled = false,
}: {
  project: GcpProject
  selectedBucket: Bucket | null
  onSelectBucket: (bucket: Bucket, projectId: string) => void
  defaultExpanded?: boolean
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const { buckets, loading, error } = useBuckets(expanded ? project.projectId : "")

  // Auto-expand projects that have buckets
  useEffect(() => {
    if (defaultExpanded && !disabled) {
      setExpanded(true)
    }
  }, [defaultExpanded, disabled])

  const toggle = useCallback(() => {
    if (!disabled) setExpanded((prev) => !prev)
  }, [disabled])

  const displayName = project.displayName || project.projectId
  const bucketCountLabel = project.bucketCount != null && project.bucketCount > 0
    ? ` (${project.bucketCount})`
    : ""

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1.5 text-sm transition-colors rounded-sm mx-1",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-muted/50 cursor-pointer"
        )}
        onClick={toggle}
        disabled={disabled}
      >
        {disabled ? (
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Database className={cn("h-3.5 w-3.5 shrink-0", disabled ? "text-muted-foreground" : "text-blue-500")} />
        <span className="truncate font-medium">{displayName}</span>
        {bucketCountLabel && (
          <span className="text-xs text-muted-foreground shrink-0">{bucketCountLabel}</span>
        )}
      </button>

      {expanded && !disabled && (
        <div className="ml-4">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading buckets...
            </div>
          ) : error ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">Access denied</span>
            </div>
          ) : buckets.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              No buckets
            </div>
          ) : (
            (() => {
              const readable = buckets.filter((b) => b.readable !== false)
              const unreadable = buckets.filter((b) => b.readable === false)
              return (
                <>
                  {readable.map((bucket) => {
                    const isSelected = selectedBucket?.name === bucket.name
                    return (
                      <button
                        key={bucket.name}
                        className={cn(
                          "flex w-full items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors rounded-sm mx-1",
                          isSelected && "bg-primary/10 text-primary font-medium"
                        )}
                        onClick={() => onSelectBucket(bucket, project.projectId)}
                      >
                        {isSelected ? (
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        ) : (
                          <Folder className={cn("h-3.5 w-3.5 shrink-0", bucket.hasObjects ? "text-amber-500" : "text-muted-foreground/50")} />
                        )}
                        <span className={cn("truncate", !bucket.hasObjects && "text-muted-foreground")}>
                          {bucket.name}
                        </span>
                      </button>
                    )
                  })}
                  {unreadable.length > 0 && (
                    <>
                      {readable.length > 0 && (
                        <div className="px-2 pt-2 pb-0.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                            No read access
                          </p>
                        </div>
                      )}
                      {unreadable.map((bucket) => (
                        <div
                          key={bucket.name}
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm opacity-40 cursor-not-allowed mx-1"
                        >
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate text-muted-foreground">{bucket.name}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )
            })()
          )}
        </div>
      )}
    </div>
  )
}
