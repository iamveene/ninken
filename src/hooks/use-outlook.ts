"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type OutlookMessage = {
  id: string
  subject: string
  bodyPreview: string
  body?: { contentType: string; content: string }
  from?: { emailAddress: { name: string; address: string } }
  toRecipients?: { emailAddress: { name: string; address: string } }[]
  ccRecipients?: { emailAddress: { name: string; address: string } }[]
  receivedDateTime: string
  isRead: boolean
  isDraft: boolean
  hasAttachments: boolean
  flag?: { flagStatus: string }
  importance: string
  conversationId?: string
}

export type OutlookFolder = {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

export type OutlookAttachment = {
  id: string
  name: string
  contentType: string
  size: number
}

type MessagesResult = {
  messages: OutlookMessage[]
  nextPageToken: string | null
}

export function useOutlookMessages(folderId?: string, limit = 50) {
  const cacheKey = `outlook:messages:${folderId || "inbox"}:${limit}`

  const fetcher = useCallback(async (): Promise<MessagesResult> => {
    const params = new URLSearchParams()
    if (folderId) params.set("folder", folderId)
    params.set("limit", String(limit))
    const res = await fetch(`/api/microsoft/mail/messages?${params}`)
    if (!res.ok) throw new Error("Failed to fetch messages")
    const json = await res.json()
    return {
      messages: json.messages ?? [],
      nextPageToken: json.nextPageToken ?? null,
    }
  }, [folderId, limit])

  const { data, loading, error, refetch } = useCachedQuery<MessagesResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    messages: data?.messages ?? [],
    loading,
    error,
    nextPageToken: data?.nextPageToken ?? null,
    refetch,
  }
}

export function useOutlookMessage(id: string | null) {
  const cacheKey = id ? `outlook:message:${id}` : null

  const fetcher = useCallback(async (): Promise<OutlookMessage> => {
    const res = await fetch(`/api/microsoft/mail/messages/${id}`)
    if (!res.ok) throw new Error("Failed to fetch message")
    return res.json()
  }, [id])

  const { data, loading, error } = useCachedQuery<OutlookMessage>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { message: data, loading, error }
}

export function useOutlookFolders() {
  const fetcher = useCallback(async (): Promise<OutlookFolder[]> => {
    const res = await fetch("/api/microsoft/mail/folders")
    if (!res.ok) throw new Error("Failed to fetch folders")
    const json = await res.json()
    return json.folders ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<OutlookFolder[]>(
    "outlook:folders",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { folders: data ?? [], loading, error, refetch }
}

export function useSendOutlookMessage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async (payload: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    conversationId?: string
  }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/microsoft/mail/messages", {
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

export function useOutlookSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const cacheKey = debouncedQuery.trim() ? `outlook:search:${debouncedQuery}` : null

  const fetcher = useCallback(async (): Promise<OutlookMessage[]> => {
    const params = new URLSearchParams({ q: debouncedQuery })
    const res = await fetch(`/api/microsoft/mail/search?${params}`)
    if (!res.ok) throw new Error("Failed to search messages")
    const json = await res.json()
    return json.messages ?? []
  }, [debouncedQuery])

  const { data, loading, error } = useCachedQuery<OutlookMessage[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { messages: data ?? [], loading, error }
}

export function useTrashOutlookMessage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trash = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/microsoft/mail/messages/${id}`, { method: "DELETE" })
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

export function useModifyOutlookMessage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modify = useCallback(async (id: string, properties: { isRead?: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/microsoft/mail/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(properties),
      })
      if (!res.ok) throw new Error("Failed to modify message")
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
