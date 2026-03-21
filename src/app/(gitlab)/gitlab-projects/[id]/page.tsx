"use client"

import { useCallback, useMemo } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Folder,
  File,
  FileCode,
  ChevronRight,
  GitBranch,
  ExternalLink,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ServiceError } from "@/components/ui/service-error"
import { CollectButton } from "@/components/collection/collect-button"
import { GitLabFileViewer } from "@/components/gitlab/file-viewer"
import {
  useGitLabTree,
  useGitLabFile,
  useGitLabBranches,
  useGitLabProjects,
} from "@/hooks/use-gitlab"

const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "kt",
  "c", "cpp", "h", "hpp", "cs", "swift", "sh", "bash", "zsh",
  "yml", "yaml", "toml", "json", "xml", "html", "css", "scss",
  "sql", "graphql", "proto", "tf", "hcl", "dockerfile", "mk",
  "makefile", "cmake", "gradle", "vue", "svelte", "astro",
])

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (CODE_EXTENSIONS.has(ext)) return FileCode
  return File
}

export default function GitLabProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const projectId = params.id ? Number(params.id) : null
  const currentPath = searchParams.get("path") ?? ""
  const currentRef = searchParams.get("ref") ?? ""
  const selectedFile = searchParams.get("file") ?? null

  // Fetch project info from cached projects list
  const { projects } = useGitLabProjects()
  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  )

  // Use default branch from project if ref not in URL
  const effectiveRef = currentRef || project?.defaultBranch || "main"

  // Fetch data
  const { branches, loading: branchesLoading } = useGitLabBranches(projectId)
  const { items, loading: treeLoading, error: treeError, refetch } = useGitLabTree(
    projectId,
    currentPath,
    effectiveRef
  )
  const { file: fileContent, loading: fileLoading, error: fileError } = useGitLabFile(
    projectId,
    selectedFile,
    effectiveRef
  )

  // Sort: folders first, then files, alphabetically
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1
      if (a.type !== "tree" && b.type === "tree") return 1
      return a.name.localeCompare(b.name)
    })
  }, [items])

  // Build breadcrumb segments from current path
  const pathSegments = useMemo(() => {
    if (!currentPath) return []
    return currentPath.split("/").filter(Boolean)
  }, [currentPath])

  // Navigation helpers
  const navigateTo = useCallback(
    (path: string, ref: string, file?: string | null) => {
      const params = new URLSearchParams()
      if (path) params.set("path", path)
      if (ref) params.set("ref", ref)
      if (file) params.set("file", file)
      router.push(`/gitlab-projects/${projectId}?${params.toString()}`)
    },
    [projectId, router]
  )

  const handleFolderClick = useCallback(
    (folderPath: string) => {
      navigateTo(folderPath, effectiveRef, null)
    },
    [navigateTo, effectiveRef]
  )

  const handleFileClick = useCallback(
    (filePath: string) => {
      navigateTo(currentPath, effectiveRef, filePath)
    },
    [navigateTo, currentPath, effectiveRef]
  )

  const handleBreadcrumbNav = useCallback(
    (targetPath: string) => {
      navigateTo(targetPath, effectiveRef, null)
    },
    [navigateTo, effectiveRef]
  )

  const handleBranchChange = useCallback(
    (newRef: string | null) => {
      if (newRef) navigateTo("", newRef, null)
    },
    [navigateTo]
  )

  const handleCloseFile = useCallback(() => {
    navigateTo(currentPath, effectiveRef, null)
  }, [navigateTo, currentPath, effectiveRef])

  const projectName = project?.pathWithNamespace ?? `Project #${params.id}`
  const projectWebUrl = project?.webUrl

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/gitlab-projects" title="Back to projects" className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate flex items-center gap-2">
              <Folder className="h-5 w-5 shrink-0" />
              {projectName}
            </h1>
            {project?.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {projectWebUrl && (
            <a href={projectWebUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 h-8 text-xs font-medium hover:bg-accent transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              GitLab
            </a>
          )}
        </div>
      </div>

      {/* Branch selector + breadcrumbs row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Branch selector */}
        <Select
          value={effectiveRef}
          onValueChange={handleBranchChange}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <GitBranch className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Select branch..." />
          </SelectTrigger>
          <SelectContent>
            {branchesLoading ? (
              <SelectItem value="_loading" disabled>
                Loading branches...
              </SelectItem>
            ) : branches.length === 0 ? (
              <SelectItem value={effectiveRef} className="text-xs">
                {effectiveRef}
              </SelectItem>
            ) : (
              branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name} className="text-xs">
                  {branch.name}
                  {branch.default && (
                    <Badge variant="secondary" className="ml-2 text-[9px] px-1 py-0">
                      default
                    </Badge>
                  )}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {pathSegments.length === 0 && !selectedFile ? (
                <BreadcrumbPage className="flex items-center gap-1.5 text-xs">
                  <Folder className="h-3.5 w-3.5" />
                  root
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="flex cursor-pointer items-center gap-1.5 text-xs"
                  onClick={() => handleBreadcrumbNav("")}
                >
                  <Folder className="h-3.5 w-3.5" />
                  root
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {pathSegments.map((segment, i) => {
              const segmentPath = pathSegments.slice(0, i + 1).join("/")
              const isLast = i === pathSegments.length - 1 && !selectedFile
              return (
                <span key={segmentPath} className="contents">
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3 w-3" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="text-xs">{segment}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        className="cursor-pointer text-xs"
                        onClick={() => handleBreadcrumbNav(segmentPath)}
                      >
                        {segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              )
            })}

            {selectedFile && (
              <span className="contents">
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs">
                    {selectedFile.split("/").pop()}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </span>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Error state */}
      {treeError && <ServiceError error={treeError} onRetry={refetch} />}

      {/* Tree listing */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs w-[80px] text-right">Type</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {treeLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedItems.length === 0 && !treeError ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                  {currentPath ? "This folder is empty" : "No files in this repository"}
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => {
                const isFolder = item.type === "tree"
                const Icon = isFolder ? Folder : getFileIcon(item.name)
                const isActive = selectedFile === item.path

                return (
                  <TableRow
                    key={`${item.type}-${item.path}`}
                    className={`cursor-pointer transition-colors ${
                      isActive
                        ? "bg-primary/8 hover:bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      isFolder
                        ? handleFolderClick(item.path)
                        : handleFileClick(item.path)
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isFolder
                              ? "text-blue-400"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-xs truncate">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          isFolder
                            ? "border-blue-500/30 text-blue-400"
                            : "border-zinc-500/30 text-zinc-400"
                        }`}
                      >
                        {isFolder ? "dir" : "file"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CollectButton
                        variant="icon-xs"
                        params={{
                          type: isFolder ? "group" : "file",
                          source: "gitlab",
                          title: item.name,
                          subtitle: item.path,
                          sourceId: `gitlab-tree-${projectId}-${item.path}`,
                          downloadUrl: !isFolder ? `/api/gitlab/projects/${projectId}/file?path=${encodeURIComponent(item.path)}&ref=${encodeURIComponent(effectiveRef)}&download=true` : undefined,
                          metadata: {
                            projectId: projectId?.toString(),
                            path: item.path,
                            ref: effectiveRef,
                            mode: item.mode,
                            itemType: item.type,
                          },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* File viewer */}
      {selectedFile && (
        <div>
          {fileLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading file...</span>
            </div>
          ) : fileError ? (
            <ServiceError error={fileError} />
          ) : fileContent ? (
            <GitLabFileViewer
              file={fileContent}
              projectId={String(projectId)}
              projectWebUrl={projectWebUrl}
              gitRef={effectiveRef}
              onClose={handleCloseFile}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
