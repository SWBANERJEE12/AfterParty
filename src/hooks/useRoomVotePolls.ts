import { useCallback, useEffect, useId, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export type VotePollRow = {
  id: string
  room_id: string
  proposer_member_key: string
  proposer_nickname: string
  imdb_id: string
  title: string
  poster_url: string | null
  release_year: string | null
  youtube_video_id: string | null
  status: 'open' | 'finalized' | 'cancelled'
  result: 'passed' | 'failed' | null
  expires_at: string
  finalized_at: string | null
  created_at: string
}

export type VotePollDetails = {
  poll: VotePollRow
  up: number
  down: number
  eligible: number
  my_vote: number | null
}

export function useRoomVotePolls(
  roomId: string,
  memberKey: string,
  membershipReady: boolean,
  channel: RealtimeChannel | null,
) {
  const subscriberId = useId()
  const [activePollId, setActivePollId] = useState<string | null>(null)
  const [details, setDetails] = useState<VotePollDetails | null>(null)

  const refreshPoll = useCallback(
    async (pollId: string) => {
      if (!isSupabaseConfigured) return
      const supabase = getSupabase()
      if (!supabase) return
      const { data, error } = await supabase.rpc('get_room_vote_poll', {
        p_poll_id: pollId,
        p_member_key: memberKey,
      })
      if (error || !data) return
      const parsed = data as VotePollDetails
      if (!parsed?.poll?.id) return
      setDetails(parsed)
    },
    [memberKey],
  )

  const scanOpen = useCallback(async () => {
    if (!membershipReady || !roomId) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = await supabase.rpc('fetch_open_room_vote_polls', {
      p_room_id: roomId,
      p_member_key: memberKey,
    })
    const rows = (data ?? []) as VotePollRow[]
    if (rows.length > 0) {
      setActivePollId(rows[0].id)
      await refreshPoll(rows[0].id)
    }
  }, [roomId, memberKey, membershipReady, refreshPoll])

  useEffect(() => {
    setActivePollId(null)
    setDetails(null)
    void scanOpen()
  }, [roomId, scanOpen])

  useEffect(() => {
    if (!channel || !membershipReady) return
    const supabase = getSupabase()
    if (!supabase) return
    const sub = supabase
      .channel(`vote-polls:${roomId}:${subscriberId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_vote_polls', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as VotePollRow
          if (row?.id) {
            setActivePollId(row.id)
            void refreshPoll(row.id)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_vote_ballots' },
        () => {
          if (activePollId) void refreshPoll(activePollId)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [channel, roomId, membershipReady, activePollId, refreshPoll, subscriberId])

  const castVote = useCallback(
    async (pollId: string, vote: 1 | -1) => {
      const supabase = getSupabase()
      if (!supabase) return { ok: false as const, error: 'No client' }
      const { error } = await supabase.rpc('cast_room_vote', {
        p_poll_id: pollId,
        p_member_key: memberKey,
        p_vote: vote,
      })
      if (error) return { ok: false as const, error: error.message }
      await refreshPoll(pollId)
      return { ok: true as const }
    },
    [memberKey, refreshPoll],
  )

  const tryFinalize = useCallback(
    async (pollId: string) => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data, error } = await supabase.rpc('finalize_room_vote_poll', {
        p_poll_id: pollId,
        p_member_key: memberKey,
      })
      if (!error && data) {
        await refreshPoll(pollId)
      }
    },
    [memberKey, refreshPoll],
  )

  useEffect(() => {
    if (!details?.poll || details.poll.status !== 'open') return
    const ms = new Date(details.poll.expires_at).getTime() - Date.now()
    if (ms <= 0) {
      void tryFinalize(details.poll.id)
      return
    }
    const t = window.setTimeout(() => void tryFinalize(details.poll.id), ms + 50)
    return () => window.clearTimeout(t)
  }, [details, tryFinalize])

  return {
    activePollId,
    details,
    setActivePollId,
    refreshPoll,
    castVote,
    tryFinalize,
  }
}
