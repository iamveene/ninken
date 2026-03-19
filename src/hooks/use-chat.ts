"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type ChatSpace = {
  name: string
  displayName: string
  type: string
  spaceType: string
  singleUserBotDm: boolean
  threaded: boolean
  externalUserAllowed: boolean
  spaceThreadingState: string
  membershipCount?: {
    joinedDirectHumanUserCount: number
    joinedGroupCount: number
  }
}

export type ChatMessageSender = {
  name: string
  displayName: string
  type: string
}

export type ChatAttachment = {
  name: string
  contentName: string
  contentType: string
  thumbnailUri: string
  downloadUri: string
  source: string
}

export type ChatMessage = {
  name: string
  sender: ChatMessageSender | null
  createTime: string
  lastUpdateTime: string
  text: string
  formattedText: string
  threadName: string
  space: string
  argumentText: string
  attachment: ChatAttachment[]
  clientAssignedMessageId: string
}

export type ChatMember = {
  name: string
  state: string
  role: string
  createTime: string
  member: {
    name: string
    displayName: string
    type: string
  } | null
}

type SpacesResult = {
  spaces: ChatSpace[]
  nextPageToken: string | null
}

type MessagesResult = {
  messages: ChatMessage[]
  nextPageToken: string | null
}

type MembersResult = {
  members: ChatMember[]
  nextPageToken: string | null
}

function extractSpaceId(spaceName: string): string {
  // Space names are in the format "spaces/{spaceId}"
  return spaceName.replace("spaces/", "")
}

export function useSpaces() {
  const fetcher = useCallback(async (): Promise<SpacesResult> => {
    const res = await fetch("/api/chat/spaces")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch spaces (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<SpacesResult>(
    "chat:spaces",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    spaces: data?.spaces ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    loading,
    error,
    refetch,
  }
}

export function useSpaceMessages(spaceId: string | null) {
  const cacheKey = spaceId ? `chat:messages:${spaceId}` : null

  const fetcher = useCallback(async (): Promise<MessagesResult> => {
    const res = await fetch(`/api/chat/spaces/${spaceId}/messages`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch messages (${res.status})`)
    }
    return res.json()
  }, [spaceId])

  const { data, loading, error, refetch } = useCachedQuery<MessagesResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return {
    messages: data?.messages ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    loading,
    error,
    refetch,
  }
}

export function useSpaceMembers(spaceId: string | null) {
  const cacheKey = spaceId ? `chat:members:${spaceId}` : null

  const fetcher = useCallback(async (): Promise<MembersResult> => {
    const res = await fetch(`/api/chat/spaces/${spaceId}/members`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch members (${res.status})`)
    }
    return res.json()
  }, [spaceId])

  const { data, loading, error, refetch } = useCachedQuery<MembersResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    members: data?.members ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    loading,
    error,
    refetch,
  }
}

export { extractSpaceId }
