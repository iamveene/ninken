"use client"

import { useState, useCallback } from "react"
import { Terminal } from "lucide-react"
import { PanelGroup, ResizablePanel, ResizeHandle } from "@/components/ui/resize-handle"
import { RequestBuilder } from "@/components/studio/api-explorer/request-builder"
import { ResponseViewer, type ProxyResponse } from "@/components/studio/api-explorer/response-viewer"
import { HistoryPanel, type ReplayData } from "@/components/studio/api-explorer/history-panel"

export default function ApiExplorerPage() {
  const [response, setResponse] = useState<ProxyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [replayData, setReplayData] = useState<ReplayData | null>(null)

  const handleReplay = useCallback((data: ReplayData) => {
    setReplayData(data)
  }, [])

  const handleReplayConsumed = useCallback(() => {
    setReplayData(null)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          API Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send HTTP requests through a server-side proxy. Bypasses CORS restrictions for API testing.
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Cmd+Enter</kbd> to send.
        </p>
      </div>

      {/* Split panels */}
      <div className="flex-1 min-h-0 border border-border/40 rounded-lg overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel id="req" defaultSize="1fr" minSize="300px">
            <div className="h-full flex flex-col overflow-hidden">
              <RequestBuilder
                onResponse={setResponse}
                onLoadingChange={setLoading}
                replayData={replayData}
                onReplayConsumed={handleReplayConsumed}
              />
            </div>
          </ResizablePanel>

          <ResizeHandle />

          <ResizablePanel id="res" defaultSize="1fr" minSize="250px">
            <ResponseViewer response={response} loading={loading} />
          </ResizablePanel>
        </PanelGroup>
      </div>

      {/* History panel */}
      <div className="shrink-0 border border-border/40 rounded-lg overflow-hidden">
        <HistoryPanel onReplay={handleReplay} />
      </div>
    </div>
  )
}
