"use client"

import { FileText } from "lucide-react"
import { PaperContent } from "@/components/studio/foci-paper/paper-content"

export default function FociPaperPage() {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          FOCI Research Paper
        </h1>
        <p className="text-sm font-medium mt-1">
          From Outlook to Everything: Microsoft SPA Token Extraction and Scope Expansion
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          A Case Study in M365 Token Abuse — ACME Corp Engagement
        </p>
      </div>

      {/* Paper Content */}
      <PaperContent />
    </div>
  )
}
