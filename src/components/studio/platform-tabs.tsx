"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface PlatformTabsProps {
  defaultValue?: string
  children: React.ReactNode
}

export function PlatformTabs({ defaultValue = "all", children }: PlatformTabsProps) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="all">All Platforms</TabsTrigger>
        <TabsTrigger value="google">Google</TabsTrigger>
        <TabsTrigger value="microsoft">Microsoft</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}

export { TabsContent as PlatformTabContent }
