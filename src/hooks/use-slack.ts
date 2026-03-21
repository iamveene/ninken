"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type SlackChannel = {
  id: string
  name: string
  isChannel: boolean
  isGroup: boolean
  isIm: boolean
  isMpim: boolean
  isPrivate: boolean
  isArchived: boolean
  isMember: boolean
  memberCount: number
  topic: string
  purpose: string
  creator: string
  created: number
  updated: number
}

export type SlackMessage = {
  type: string
  subtype?: string
  user?: string
  text: string
  ts: string
  threadTs?: string
  replyCount: number
  replyUsersCount: number
  reactions?: { name: string; count: number; users: string[] }[]
  files?: { id: string; name: string; mimetype: string; size: number }[]
  hasAttachments: boolean
}

export type SlackFile = {
  id: string
  name: string
  title: string
  mimetype: string
  filetype: string
  size: number
  user: string
  created: number
  channels: string[]
  permalink: string
  isExternal: boolean
  isPublic: boolean
}

export type SlackUser = {
  id: string
  name: string
  realName: string
  displayName: string
  email?: string
  title?: string
  avatar?: string
  statusText?: string
  statusEmoji?: string
  isAdmin: boolean
  isOwner: boolean
  isPrimaryOwner: boolean
  isRestricted: boolean
  isUltraRestricted: boolean
  isBot: boolean
  isDeleted: boolean
  updated: number
  tz?: string
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useSlackChannels(view = "all", limit = 200) {
  const cacheKey = `slack:channels:${view}:${limit}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({ view, limit: String(limit) })
    const res = await fetch(`/api/slack/channels?${params}`)
    if (!res.ok) throw new Error("Failed to fetch channels")
    const json = await res.json()
    return {
      channels: (json.channels ?? []) as SlackChannel[],
      nextCursor: (json.nextCursor ?? null) as string | null,
    }
  }, [view, limit])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    channels: data?.channels ?? [],
    loading,
    error,
    nextCursor: data?.nextCursor ?? null,
    refetch,
  }
}

export function useSlackMessages(
  channelId: string | null,
  limit = 50,
  cursor?: string
) {
  const cacheKey = channelId
    ? `slack:messages:${channelId}:${limit}:${cursor || ""}`
    : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set("cursor", cursor)
    const res = await fetch(
      `/api/slack/channels/${channelId}/messages?${params}`
    )
    if (!res.ok) throw new Error("Failed to fetch messages")
    const json = await res.json()
    return {
      messages: (json.messages ?? []) as SlackMessage[],
      hasMore: (json.hasMore ?? false) as boolean,
      nextCursor: (json.nextCursor ?? null) as string | null,
    }
  }, [channelId, limit, cursor])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_BODY,
  })

  return {
    messages: data?.messages ?? [],
    loading,
    error,
    hasMore: data?.hasMore ?? false,
    nextCursor: data?.nextCursor ?? null,
    refetch,
  }
}

export function useSlackReplies(
  channelId: string | null,
  threadTs: string | null
) {
  const cacheKey =
    channelId && threadTs
      ? `slack:replies:${channelId}:${threadTs}`
      : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({ ts: threadTs! })
    const res = await fetch(
      `/api/slack/channels/${channelId}/replies?${params}`
    )
    if (!res.ok) throw new Error("Failed to fetch replies")
    const json = await res.json()
    return {
      messages: (json.messages ?? []) as SlackMessage[],
      hasMore: (json.hasMore ?? false) as boolean,
    }
  }, [channelId, threadTs])

  const { data, loading, error } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_BODY,
  })

  return {
    messages: data?.messages ?? [],
    loading,
    error,
    hasMore: data?.hasMore ?? false,
  }
}

export function useSlackFiles(channel?: string, page = 1, count = 50) {
  const cacheKey = `slack:files:${channel || "all"}:${page}:${count}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      count: String(count),
      page: String(page),
    })
    if (channel) params.set("channel", channel)
    const res = await fetch(`/api/slack/files?${params}`)
    if (!res.ok) throw new Error("Failed to fetch files")
    const json = await res.json()
    return {
      files: (json.files ?? []) as SlackFile[],
      paging: json.paging as {
        count: number
        total: number
        page: number
        pages: number
      },
    }
  }, [channel, page, count])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    files: data?.files ?? [],
    paging: data?.paging ?? { count: 0, total: 0, page: 1, pages: 0 },
    loading,
    error,
    refetch,
  }
}

export function useSlackUsers(limit = 200) {
  const cacheKey = `slack:users:${limit}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit) })
    const res = await fetch(`/api/slack/users?${params}`)
    if (!res.ok) throw new Error("Failed to fetch users")
    const json = await res.json()
    return {
      users: (json.users ?? []) as SlackUser[],
      nextCursor: (json.nextCursor ?? null) as string | null,
    }
  }, [limit])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    users: data?.users ?? [],
    loading,
    error,
    nextCursor: data?.nextCursor ?? null,
    refetch,
  }
}
