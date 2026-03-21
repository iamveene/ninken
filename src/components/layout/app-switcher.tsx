"use client"

import { LayoutGrid } from "lucide-react"
import Link from "next/link"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useProvider } from "@/components/providers/provider-context"
import { getAllProviders } from "@/lib/providers"
import { resolveIcon } from "@/lib/icon-resolver"
import { cn } from "@/lib/utils"

const STUDIO_ENTRY = {
  id: "studio" as const,
  name: "Studio",
  iconName: "BrainCircuit",
  defaultRoute: "/studio",
}

export function AppSwitcher() {
  const { profiles } = useProvider()
  const providers = getAllProviders()

  const tiles = [
    ...providers.map((p) => ({
      id: p.id,
      name: p.name,
      iconName: p.iconName,
      defaultRoute: p.defaultRoute,
      connected: profiles.some((prof) => prof.provider === p.id),
    })),
    { ...STUDIO_ENTRY, connected: true },
  ]

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="App Switcher" />
        }
      >
        <LayoutGrid className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Services
        </p>
        <div className="grid grid-cols-3 gap-1">
          {tiles.map((tile) => {
            const Icon = resolveIcon(tile.iconName)
            return (
              <Link
                key={tile.id}
                href={tile.defaultRoute}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md p-2.5 text-center transition-colors hover:bg-muted",
                  !tile.connected && "opacity-40"
                )}
              >
                <Icon className="size-6" />
                <span className="text-[0.65rem] leading-tight font-medium">
                  {tile.name}
                </span>
                {tile.connected && tile.id !== "studio" && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[0.55rem]"
                  >
                    Connected
                  </Badge>
                )}
              </Link>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
