"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { ServiceCard } from "@/components/studio/service-card"
import { PlatformTabs, PlatformTabContent } from "@/components/studio/platform-tabs"
import { GOOGLE_SERVICES } from "@/lib/studio/google-services"
import { MICROSOFT_SERVICES } from "@/lib/studio/microsoft-services"
import { Badge } from "@/components/ui/badge"
import { Globe, Search } from "lucide-react"

export default function ServiceMapPage() {
  const [search, setSearch] = useState("")

  const filteredGoogle = useMemo(() => {
    if (!search) return GOOGLE_SERVICES
    const lower = search.toLowerCase()
    return GOOGLE_SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.category.toLowerCase().includes(lower) ||
        s.scopes.some((sc) => sc.toLowerCase().includes(lower))
    )
  }, [search])

  const filteredMicrosoft = useMemo(() => {
    if (!search) return MICROSOFT_SERVICES
    const lower = search.toLowerCase()
    return MICROSOFT_SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.category.toLowerCase().includes(lower) ||
        s.scopes.some((sc) => sc.toLowerCase().includes(lower))
    )
  }, [search])

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          Service Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          API catalog with scopes, endpoints, and stealth ratings for Google and Microsoft services.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services, scopes, endpoints..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <PlatformTabs>
        <PlatformTabContent value="all">
          <div className="space-y-6 mt-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Services</h2>
                <Badge variant="outline" className="text-[9px]">{filteredGoogle.length}</Badge>
              </div>
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                {filteredGoogle.map((svc) => (
                  <ServiceCard
                    key={svc.id}
                    name={svc.name}
                    description={svc.description}
                    category={svc.category}
                    stealthLevel={svc.stealthLevel}
                    commonlyMonitored={svc.commonlyMonitored}
                    scopes={svc.scopes}
                    endpoints={svc.endpoints}
                    docsUrl={svc.docsUrl}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Microsoft Services</h2>
                <Badge variant="outline" className="text-[9px]">{filteredMicrosoft.length}</Badge>
              </div>
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                {filteredMicrosoft.map((svc) => (
                  <ServiceCard
                    key={svc.id}
                    name={svc.name}
                    description={svc.description}
                    category={svc.category}
                    stealthLevel={svc.stealthLevel}
                    commonlyMonitored={svc.commonlyMonitored}
                    scopes={svc.scopes}
                    endpoints={svc.endpoints}
                    docsUrl={svc.docsUrl}
                  />
                ))}
              </div>
            </div>
          </div>
        </PlatformTabContent>

        <PlatformTabContent value="google">
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 mt-4">
            {filteredGoogle.map((svc) => (
              <ServiceCard
                key={svc.id}
                name={svc.name}
                description={svc.description}
                category={svc.category}
                stealthLevel={svc.stealthLevel}
                commonlyMonitored={svc.commonlyMonitored}
                scopes={svc.scopes}
                endpoints={svc.endpoints}
                docsUrl={svc.docsUrl}
              />
            ))}
          </div>
        </PlatformTabContent>

        <PlatformTabContent value="microsoft">
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 mt-4">
            {filteredMicrosoft.map((svc) => (
              <ServiceCard
                key={svc.id}
                name={svc.name}
                description={svc.description}
                category={svc.category}
                stealthLevel={svc.stealthLevel}
                commonlyMonitored={svc.commonlyMonitored}
                scopes={svc.scopes}
                endpoints={svc.endpoints}
                docsUrl={svc.docsUrl}
              />
            ))}
          </div>
        </PlatformTabContent>
      </PlatformTabs>
    </div>
  )
}
