"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Play } from "lucide-react"

export default function GitLabPipelinesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Play className="h-5 w-5" />
          Pipelines
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          CI/CD pipeline enumeration across accessible projects
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Play className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Pipeline enumeration coming soon.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate pipelines, jobs, runners, and CI/CD variables across all accessible projects.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
