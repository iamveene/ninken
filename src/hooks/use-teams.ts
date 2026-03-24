"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type Team = {
  id: string
  displayName: string
  description?: string
}

export type Channel = {
  id: string
  displayName: string
  description?: string
  membershipType?: string
}

export type ChannelMessage = {
  id: string
  body: { contentType: string; content: string }
  from?: { user?: { displayName: string; id: string } }
  createdDateTime: string
}

export type Chat = {
  id: string
  topic: string | null
  chatType: string
  lastUpdatedDateTime: string | null
}

export type ChatMessage = {
  id: string
  body: { contentType: string; content: string }
  from?: { user?: { displayName: string; id: string } }
  createdDateTime: string
}

export function useJoinedTeams() {
  const fetcher = useCallback(async (): Promise<Team[]> => {
    const res = await fetch("/api/microsoft/teams/joined")
    if (!res.ok) throw new Error("Failed to fetch teams")
    const json = await res.json()
    return json.teams ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<Team[]>(
    "teams:joined",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { teams: data ?? [], loading, error, refetch }
}

export function useChannels(teamId: string | null) {
  const cacheKey = teamId ? `teams:channels:${teamId}` : null

  const fetcher = useCallback(async (): Promise<Channel[]> => {
    const res = await fetch(`/api/microsoft/teams/${teamId}/channels`)
    if (!res.ok) throw new Error("Failed to fetch channels")
    const json = await res.json()
    return json.channels ?? []
  }, [teamId])

  const { data, loading, error, refetch } = useCachedQuery<Channel[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { channels: data ?? [], loading, error, refetch }
}

export function useChannelMessages(teamId: string | null, channelId: string | null) {
  const cacheKey = teamId && channelId ? `teams:messages:${teamId}:${channelId}` : null

  const fetcher = useCallback(async (): Promise<ChannelMessage[]> => {
    const res = await fetch(`/api/microsoft/teams/${teamId}/channels/${channelId}/messages`)
    if (!res.ok) throw new Error("Failed to fetch messages")
    const json = await res.json()
    return json.messages ?? []
  }, [teamId, channelId])

  const { data, loading, error, refetch } = useCachedQuery<ChannelMessage[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { messages: data ?? [], loading, error, refetch }
}

export function useChats() {
  const fetcher = useCallback(async (): Promise<Chat[]> => {
    const res = await fetch("/api/microsoft/teams/chats")
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error || `Failed to fetch chats (${res.status})`)
    }
    const json = await res.json()
    return json.chats ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<Chat[]>(
    "teams:chats",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { chats: data ?? [], loading, error, refetch }
}

export function useChatMessages(chatId: string | null) {
  const cacheKey = chatId ? `teams:chatMessages:${chatId}` : null

  const fetcher = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch(`/api/microsoft/teams/chats/${chatId}/messages`)
    if (!res.ok) throw new Error("Failed to fetch chat messages")
    const json = await res.json()
    return json.messages ?? []
  }, [chatId])

  const { data, loading, error, refetch } = useCachedQuery<ChatMessage[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { messages: data ?? [], loading, error, refetch }
}
