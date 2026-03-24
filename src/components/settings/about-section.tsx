"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { useProvider } from "@/components/providers/provider-context"

export function AboutSection() {
  const { profiles } = useProvider()
  const [platform, setPlatform] = useState("")

  useEffect(() => {
    setPlatform(navigator.platform || "Unknown")
  }, [])

  const isDev = process.env.NODE_ENV === "development"

  const items = [
    { label: "Version", value: "0.5.0" },
    { label: "Loaded Profiles", value: String(profiles.length) },
    { label: "Platform", value: platform || "Detecting..." },
    { label: "Build", value: isDev ? "Development" : "Production" },
  ]

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          About Ninken
        </CardTitle>
        <CardDescription>
          Red team reconnaissance platform for cloud and SaaS environments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="font-medium text-muted-foreground">{item.label}</dt>
              <dd className="text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
