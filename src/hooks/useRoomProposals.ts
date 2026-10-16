import { useEffect, useId, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export type RoomProposal = {
  id: string
  imdb_id: string
  title: string
  poster_url: string | null
  release_year: string | null
  nickname: string
  created_at: string
}

export function useRoomProposals(roomId: string, memberKey: string, enabled: boolean) {
  const subscriberId = useId()
  const [proposals, setProposals] = useState<RoomProposal[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !roomId) return
    const supabase = getSupabase()
    if (!supabase) return

    let cancelled = false
    setLoading(true)

    void (async () => {
      const { data, error } = await supabase.rpc('fetch_room_proposals', {
        p_room_id: roomId,
        p_member_key: memberKey,
      })
      if (cancelled) return
      if (error) {
        if (
          error.message.includes('fetch_room_proposals') ||
          error.message.includes('room_movie_proposals') ||
          error.message.includes('schema cache')
        ) {
          console.warn(
            '[afterparty] Proposals RPC/table missing — apply supabase/migrations/016_repair_proposals_and_playback.sql',
          )
        }
      } else if (data) setProposals(data as RoomProposal[])
      setLoading(false)
    })()

    const channel = supabase
      .channel(`proposals:${roomId}:${subscriberId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_movie_proposals', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as RoomProposal
          setProposals((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev
            return [row, ...prev].slice(0, 20)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [roomId, memberKey, enabled, subscriberId])

  return { proposals, loading }
}
