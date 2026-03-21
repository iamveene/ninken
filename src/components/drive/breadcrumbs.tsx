"use client"

import { HardDrive } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type BreadcrumbSegment = {
  id: string
  name: string
}

type DriveBreadcrumbsProps = {
  path: BreadcrumbSegment[]
  onNavigate: (folderId: string | undefined) => void
  rootLabel?: string
}

export function DriveBreadcrumbs({ path, onNavigate, rootLabel = "My Drive" }: DriveBreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {path.length === 0 ? (
            <BreadcrumbPage className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {rootLabel}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              className="flex cursor-pointer items-center gap-1.5"
              onClick={() => onNavigate(undefined)}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {rootLabel}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {path.map((segment, i) => (
          <span key={segment.id} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === path.length - 1 ? (
                <BreadcrumbPage>{segment.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => onNavigate(segment.id)}
                >
                  {segment.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
