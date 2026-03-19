"use client"

import { useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ExplorerSidebar } from "@/components/buckets/explorer-sidebar"
import { ObjectBrowser } from "@/components/buckets/object-browser"
import { SidebarSlotContent } from "@/components/sidebar-slot"
import { FolderOpen } from "lucide-react"
import type { Bucket } from "@/hooks/use-buckets"

export default function BucketsPage() {
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>("")

  const handleSelectBucket = (bucket: Bucket, projectId: string) => {
    setSelectedBucket(bucket)
    setSelectedProject(projectId)
  }

  return (
    <TooltipProvider>
      {/* Inject ExplorerSidebar into the main sidebar */}
      <SidebarSlotContent>
        <ExplorerSidebar
          selectedBucket={selectedBucket}
          onSelectBucket={handleSelectBucket}
        />
      </SidebarSlotContent>

      <div className="flex h-[calc(100vh-3rem)] -m-4">
        <div className="flex-1 min-w-0 overflow-hidden h-full">
          {selectedBucket ? (
            <div className="h-full p-4">
              <ObjectBrowser
                bucket={selectedBucket.name}
                onBackToBuckets={() => setSelectedBucket(null)}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-lg font-medium">Select a bucket</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add a project ID in the sidebar, expand it to see its buckets, then click a bucket to browse its contents.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
