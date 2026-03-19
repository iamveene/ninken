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
