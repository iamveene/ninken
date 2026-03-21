"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
  Search,
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
  const [filterQuery, setFilterQuery] = useState("")

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

  // Combine: API projects + manual projects
  const allProjects = [...projects, ...manualProjectObjects]

  // Split into accessible (with buckets), accessible (no buckets), and inaccessible
  const accessibleWithBuckets = allProjects
    .filter((p) => p.accessible !== false && (p.bucketCount ?? 0) > 0)
    .sort((a, b) => (b.bucketCount ?? 0) - (a.bucketCount ?? 0))
  const accessibleNoBuckets = allProjects
    .filter((p) => p.accessible !== false && (p.bucketCount ?? 0) === 0)
  const inaccessibleProjects = allProjects.filter((p) => p.accessible === false)

  // Accessible = with buckets first, then no buckets (grayed)
  const accessibleProjects = [...accessibleWithBuckets, ...accessibleNoBuckets]

  // Filter projects by search query
  const query = filterQuery.toLowerCase().trim()
  const matchesFilter = (p: GcpProject) =>
    p.projectId.toLowerCase().includes(query) ||
    (p.displayName?.toLowerCase().includes(query) ?? false)
  const filteredAccessible = query ? accessibleProjects.filter(matchesFilter) : accessibleProjects
  const filteredInaccessible = query ? inaccessibleProjects.filter(matchesFilter) : inaccessibleProjects

  // Identify the first project that should auto-select its first bucket
  const autoSelectProjectId = accessibleProjects.find((p) => (p.bucketCount ?? 0) > 0)?.projectId ?? null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </h3>
      </div>

      {/* Search filter — only show when there are projects to filter */}
      {!projectsLoading && allProjects.length > 0 && (
        <div className="border-b px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter projects..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {projectsLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Discovering projects...
          </div>
        ) : allProjects.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Add a project ID below to browse its buckets.
          </div>
        ) : filteredAccessible.length === 0 && filteredInaccessible.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No projects match &ldquo;{filterQuery}&rdquo;
          </div>
        ) : (
          <>
            {filteredAccessible.map((project) => {
              const hasBuckets = (project.bucketCount ?? 0) > 0
              return (
                <ProjectNode
                  key={project.projectId}
                  project={project}
                  selectedBucket={selectedBucket}
                  onSelectBucket={onSelectBucket}
                  defaultExpanded={hasBuckets}
                  autoSelect={project.projectId === autoSelectProjectId}
                  dimmed={!hasBuckets}
                />
              )
            })}

            {filteredInaccessible.length > 0 && (
              <>
                {filteredAccessible.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      No storage access
                    </p>
                  </div>
                )}
                {filteredInaccessible.map((project) => (
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
  autoSelect = false,
  dimmed = false,
}: {
  project: GcpProject
  selectedBucket: Bucket | null
  onSelectBucket: (bucket: Bucket, projectId: string) => void
  defaultExpanded?: boolean
  disabled?: boolean
  autoSelect?: boolean
  dimmed?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const { buckets, loading, error } = useBuckets(expanded ? project.projectId : "")
  const didAutoSelect = useRef(false)

  // Auto-expand projects that have buckets
  useEffect(() => {
    if (defaultExpanded && !disabled) {
      setExpanded(true)
    }
  }, [defaultExpanded, disabled])

  // Auto-select the first downloadable bucket when autoSelect is enabled
  useEffect(() => {
    if (!autoSelect || didAutoSelect.current || loading || buckets.length === 0) return
    // Only auto-select a bucket that has objects — don't land on an empty bucket
    const target = buckets.find((b) => b.readable !== false && b.downloadable !== false && b.hasObjects)
    if (!target) return // No bucket with objects in this project — don't auto-select
    if (target) {
      didAutoSelect.current = true
      onSelectBucket(target, project.projectId)
    }
  }, [autoSelect, loading, buckets, onSelectBucket, project.projectId])

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
            : dimmed
              ? "opacity-40 hover:bg-muted/50 cursor-pointer"
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
        <Database className={cn("h-3.5 w-3.5 shrink-0", disabled || dimmed ? "text-muted-foreground" : "text-blue-500")} />
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
              // Downloadable buckets at top, then browse-only, then no-access at bottom
              const downloadable = buckets
                .filter((b) => b.readable !== false && b.downloadable !== false)
                .sort((a, b) => {
                  // Buckets with objects first, empty buckets after
                  if (a.hasObjects && !b.hasObjects) return -1
                  if (!a.hasObjects && b.hasObjects) return 1
                  return a.name.localeCompare(b.name)
                })
              const browseOnly = buckets.filter((b) => b.readable !== false && b.downloadable === false)
              const unreadable = buckets.filter((b) => b.readable === false)
              const denied = [...browseOnly, ...unreadable]
              return (
                <>
                  {downloadable.map((bucket) => {
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
                  {denied.length > 0 && (
                    <>
                      {downloadable.length > 0 && (
                        <div className="px-2 pt-2 pb-0.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                            No download access
                          </p>
                        </div>
                      )}
                      {denied.map((bucket) => (
                        <button
                          key={bucket.name}
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm opacity-40 transition-colors rounded-sm mx-1 hover:bg-muted/30 cursor-pointer"
                          onClick={() => onSelectBucket(bucket, project.projectId)}
                        >
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate text-muted-foreground">{bucket.name}</span>
                        </button>
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
