"use client"

import { useEffect } from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark")
    document.documentElement.style.colorScheme = "dark"
  }, [])

  return <>{children}</>
}
