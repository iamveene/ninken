"use client"

import { useState, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type GmailMessage = {
  id: string
  threadId: string
  snippet: string
  subject: string
  from: string
  fromEmail: string
  to: string
  cc?: string
  date: string
  labelIds: string[]
  isUnread: boolean
  isStarred: boolean
  hasAttachment: boolean
  body?: string
  htmlBody?: string
  attachments?: GmailAttachment[]
}

export type GmailAttachment = {
  id: string
  filename: string
  mimeType: string
  size: number
}

export type GmailLabel = {
  id: string
  name: string
  type: string
  messagesUnread: number
  messagesTotal: number
}

export type GmailThread = {
  id: string
  messages: GmailMessage[]
}

type GmailHeader = { name: string; value: string }

type GmailPart = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { attachmentId?: string; size?: number; data?: string }
  parts?: GmailPart[]
}

type RawGmailMessage = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  payload?: {
    mimeType?: string
    headers?: GmailHeader[]
    body?: { data?: string; size?: number }
    parts?: GmailPart[]
  }
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from
}

function extractDisplayName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
  } catch {
    return atob(base64)
  }
}

function extractBody(payload: RawGmailMessage["payload"]): { text: string; html: string } {
  if (!payload) return { text: "", html: "" }

  const result = { text: "", html: "" }

  function walk(part: GmailPart) {
    if (part.mimeType === "text/plain" && part.body?.data && !result.text) {
      result.text = decodeBase64Url(part.body.data)
    }
    if (part.mimeType === "text/html" && part.body?.data && !result.html) {
      result.html = decodeBase64Url(part.body.data)
    }
    if (part.parts) part.parts.forEach(walk)
  }

  // Check top-level body
  if (payload.body?.data) {
    if (payload.mimeType === "text/html") {
      result.html = decodeBase64Url(payload.body.data)
    } else if (payload.mimeType === "text/plain") {
      result.text = decodeBase64Url(payload.body.data)
    }
  }

  if (payload.parts) payload.parts.forEach(walk)

  return result
}

function extractAttachments(payload: RawGmailMessage["payload"]): GmailAttachment[] {
  const attachments: GmailAttachment[] = []

  function walk(part: GmailPart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      })
    }
    if (part.parts) part.parts.forEach(walk)
  }

  if (payload?.parts) payload.parts.forEach(walk)
  return attachments
}

function parseGmailMessage(raw: RawGmailMessage): GmailMessage {
  const headers = raw.payload?.headers
  const from = getHeader(headers, "From")
  const { text, html } = extractBody(raw.payload)
  const attachments = extractAttachments(raw.payload)
  const labelIds = raw.labelIds ?? []

  return {
    id: raw.id,
    threadId: raw.threadId,
    snippet: raw.snippet ?? "",
    subject: getHeader(headers, "Subject"),
    from: extractDisplayName(from),
    fromEmail: extractEmailAddress(from),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc") || undefined,
    date: getHeader(headers, "Date"),
    labelIds,
    isUnread: labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    hasAttachment: attachments.length > 0,
    body: text || undefined,
    htmlBody: html || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  }
}

type MessagesResult = {
  messages: GmailMessage[]
  totalEstimate: number
  nextPageToken: string | null
}

export function useMessages(query: string, limit = 50) {
  const cacheKey = `gmail:messages:${query}:${limit}`

  const fetcher = useCallback(async (): Promise<MessagesResult> => {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    const res = await fetch(`/api/gmail/messages?${params}`)
    if (!res.ok) throw new Error("Failed to fetch messages")
    const json = await res.json()
    return {
      messages: (json.messages ?? []).map(parseGmailMessage),
      totalEstimate: json.resultSizeEstimate ?? 0,
      nextPageToken: json.nextPageToken ?? null,
    }
  }, [query, limit])

  const { data, loading, error, refetch } = useCachedQuery<MessagesResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    data: data?.messages ?? [],
    loading,
    error,
    totalEstimate: data?.totalEstimate ?? 0,
    nextPageToken: data?.nextPageToken ?? null,
    refetch,
  }
}

export function useMessage(id: string | null) {
  const cacheKey = id ? `gmail:message:${id}` : null

  const fetcher = useCallback(async (): Promise<GmailMessage> => {
    const res = await fetch(`/api/gmail/messages/${id}`)
    if (!res.ok) throw new Error("Failed to fetch message")
    const json = await res.json()
    return parseGmailMessage(json)
  }, [id])

  const { data, loading, error } = useCachedQuery<GmailMessage>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { data, loading, error }
}

export function useThread(id: string | null) {
  const cacheKey = id ? `gmail:thread:${id}` : null

  const fetcher = useCallback(async (): Promise<GmailThread> => {
    const res = await fetch(`/api/gmail/threads/${id}`)
    if (!res.ok) throw new Error("Failed to fetch thread")
    const json = await res.json()
    return {
      id: json.id,
      messages: (json.messages ?? []).map(parseGmailMessage),
    }
  }, [id])

  const { data, loading, error } = useCachedQuery<GmailThread>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { data, loading, error }
}

export function useLabels() {
  const fetcher = useCallback(async (): Promise<GmailLabel[]> => {
    const res = await fetch("/api/gmail/labels")
    if (!res.ok) throw new Error("Failed to fetch labels")
    const json = await res.json()
    return json.labels ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<GmailLabel[]>(
    "gmail:labels",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { data: data ?? [], loading, error, refetch }
}

export function useSendMessage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async (payload: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to send message")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { send, loading, error }
}

export function useTrashMessage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trash = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/gmail/messages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to trash message")
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { trash, loading, error }
}

export function useModifyLabels() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modify = useCallback(async (id: string, addLabelIds: string[], removeLabelIds: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/gmail/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      })
      if (!res.ok) throw new Error("Failed to modify labels")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { modify, loading, error }
}

export function useSaveDraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async (payload: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
  }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save draft")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { save, loading, error }
}
