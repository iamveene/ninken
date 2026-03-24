export type Mode = "operate" | "explore" | "collection" | "studio"

export function getMode(pathname: string): Mode {
  if (
    pathname.startsWith("/audit") ||
    pathname.startsWith("/m365-audit") ||
    pathname.startsWith("/gitlab-audit") ||
    pathname.startsWith("/github-audit") ||
    pathname.startsWith("/aws-audit") ||
    pathname.startsWith("/gcp-audit") ||
    pathname.startsWith("/explore")
  ) return "explore"
  if (pathname.startsWith("/studio")) return "studio"
  if (pathname.startsWith("/collection")) return "collection"
  return "operate"
}
