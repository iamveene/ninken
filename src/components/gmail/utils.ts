import DOMPurify from "dompurify"
import {
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  format,
} from "date-fns"

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  if (isToday(date)) {
    return formatDistanceToNowStrict(date, { addSuffix: false })
      .replace(" seconds", "s")
      .replace(" second", "s")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
  }

  if (isYesterday(date)) return "Yesterday"

  const now = new Date()
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "MMM d")
  }

  return format(date, "MMM d, yyyy")
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/<[^>]+>/g, "").trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (cleaned[0] || "?").toUpperCase()
}

const AVATAR_COLORS = [
  "#e53935", "#d81b60", "#8e24aa", "#5e35b1",
  "#3949ab", "#1e88e5", "#039be5", "#00acc1",
  "#00897b", "#43a047", "#7cb342", "#c0ca33",
  "#fdd835", "#ffb300", "#fb8c00", "#f4511e",
]

export function getAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function sanitizeHtml(html: string): string {
  // Remove img tags with cid: src attributes (inline images that can't be resolved in-browser)
  const withoutCid = html.replace(/<img\b[^>]*\bsrc\s*=\s*["']cid:[^"']*["'][^>]*\/?>/gi, "")

  if (typeof window === "undefined") {
    // Server-side fallback: strip all tags that could execute scripts
    return withoutCid
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
      .replace(/<object\b[^>]*>.*?<\/object>/gi, "")
      .replace(/<embed\b[^>]*\/?>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\bon\w+\s*=\s*\S+/gi, "")
      .replace(/javascript\s*:/gi, "removed:")
      .replace(/vbscript\s*:/gi, "removed:")
      .replace(/data\s*:\s*text\/html/gi, "removed:")
  }
  return DOMPurify.sanitize(withoutCid, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "textarea", "select", "button"],
    FORBID_ATTR: ["style"],
  })
}
