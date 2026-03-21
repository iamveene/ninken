"use client"

import { useState, useEffect } from "react"
import {
  useGcpKeyInfo,
  useGcpFirestoreDatabases,
  useGcpFirestoreCollections,
  useGcpFirestoreDocuments,
} from "@/hooks/use-gcp-key"
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
  Database,
  ChevronRight,
  FileText,
  Folder,
  ArrowLeft,
} from "lucide-react"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function GcpFirestorePage() {
  const [projectId, setProjectId] = useState("")
  const [selectedDb, setSelectedDb] = useState("(default)")
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<unknown | null>(null)
  const [pageToken, setPageToken] = useState<string | undefined>(undefined)
  const { info } = useGcpKeyInfo()

  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) {
      setProjectId(stored)
    } else if (info?.projectId) {
      setProjectId(info.projectId)
      sessionStorage.setItem(PROJECT_ID_KEY, info.projectId)
    }
  }, [info?.projectId])

  const handleProjectChange = (v: string) => {
    setProjectId(v)
    if (v) sessionStorage.setItem(PROJECT_ID_KEY, v)
    else sessionStorage.removeItem(PROJECT_ID_KEY)
    // Reset selections when project changes
    setSelectedCollection(null)
    setSelectedDoc(null)
    setPageToken(undefined)
  }

  const {
    databases, loading: dbLoading, error: dbError, refetch: refetchDb,
  } = useGcpFirestoreDatabases(projectId || undefined)

  const {
    collectionIds, loading: colLoading, error: colError, refetch: refetchCol,
  } = useGcpFirestoreCollections(projectId || undefined, selectedDb)

  const {
    documents, nextPageToken, loading: docLoading, error: docError, refetch: refetchDoc,
  } = useGcpFirestoreDocuments(
    projectId || undefined,
    selectedDb,
    selectedCollection ?? undefined,
    50,
    pageToken,
  )

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" />
          Firestore
        </h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Enter a GCP project ID to browse Firestore databases.
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            Firestore
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project: {projectId}
          </p>
        </div>
        <Input
          value={projectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          placeholder="Project ID"
          className="h-8 text-xs font-mono w-64"
        />
      </div>

      {/* Database Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Database:</label>
        <select
          value={selectedDb}
          onChange={(e) => {
            setSelectedDb(e.target.value)
            setSelectedCollection(null)
            setSelectedDoc(null)
            setPageToken(undefined)
          }}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="(default)">(default)</option>
          {databases
            .filter((db) => {
              const dbName = db.name?.split("/").pop()
              return dbName && dbName !== "(default)"
            })
            .map((db) => {
              const dbName = db.name?.split("/").pop() ?? db.name
              return (
                <option key={db.name} value={dbName}>{dbName}</option>
              )
            })}
        </select>
        {dbLoading && <span className="text-[10px] text-muted-foreground">Loading databases...</span>}
      </div>

      {dbError && <ServiceError error={dbError} onRetry={refetchDb} />}

      {/* Document detail view */}
      {selectedDoc !== null && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDoc(null)}
            className="h-7 px-2 gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to documents
          </Button>
          <JsonViewer data={selectedDoc} />
        </div>
      )}

      {/* Main content: collections + documents */}
      {selectedDoc === null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Collections panel */}
          <div className="md:col-span-1">
            <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              Collections
            </h3>
            {colError && <ServiceError error={colError} onRetry={refetchCol} />}
            <div className="rounded-md border">
              {colLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : collectionIds.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No collections found
                </div>
              ) : (
                <div className="divide-y">
                  {collectionIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedCollection(id)
                        setSelectedDoc(null)
                        setPageToken(undefined)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${
                        selectedCollection === id ? "bg-muted/50 font-medium" : ""
                      }`}
                    >
                      <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{id}</span>
                      <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Documents panel */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              {selectedCollection ? `Documents in "${selectedCollection}"` : "Select a collection"}
            </h3>
            {docError && <ServiceError error={docError} onRetry={refetchDoc} />}
            {selectedCollection ? (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Document ID</TableHead>
                        <TableHead className="text-xs">Fields</TableHead>
                        <TableHead className="text-xs">Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 3 }).map((__, j) => (
                              <TableCell key={j}>
                                <div className="h-4 animate-pulse rounded bg-muted" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : documents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                            No documents found
                          </TableCell>
                        </TableRow>
                      ) : (
                        documents.map((doc) => {
                          const docId = doc.name?.split("/").pop() ?? doc.name
                          const fieldCount = doc.fields ? Object.keys(doc.fields).length : 0
                          return (
                            <TableRow
                              key={doc.name}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedDoc(doc)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-mono">{docId}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px]">
                                  {fieldCount} fields
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {doc.updateTime
                                  ? new Date(doc.updateTime).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {nextPageToken && (
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageToken(nextPageToken)}
                      className="text-xs"
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-xs text-muted-foreground">
                  Select a collection from the left panel to view documents.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
