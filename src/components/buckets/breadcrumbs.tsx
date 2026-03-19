"use client"

import { Database } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BucketBreadcrumbsProps = {
  bucket: string | null
  prefix: string
  onNavigateToBuckets: () => void
  onNavigateToPrefix: (prefix: string) => void
}

export function BucketBreadcrumbs({
  bucket,
  prefix,
  onNavigateToBuckets,
  onNavigateToPrefix,
}: BucketBreadcrumbsProps) {
  const prefixParts = prefix
    ? prefix.replace(/\/$/, "").split("/")
    : []

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {!bucket ? (
            <BreadcrumbPage className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              All Buckets
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              className="flex cursor-pointer items-center gap-1.5"
              onClick={onNavigateToBuckets}
            >
              <Database className="h-3.5 w-3.5" />
              All Buckets
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {bucket && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {prefixParts.length === 0 ? (
                <BreadcrumbPage>{bucket}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => onNavigateToPrefix("")}
                >
                  {bucket}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}

        {prefixParts.map((part, i) => {
          const fullPrefix = prefixParts.slice(0, i + 1).join("/") + "/"
          const isLast = i === prefixParts.length - 1
          return (
            <span key={fullPrefix} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{part}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => onNavigateToPrefix(fullPrefix)}
                  >
                    {part}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
