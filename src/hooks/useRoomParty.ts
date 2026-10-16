import { useCallback, useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export type RoomPartyState = {
  hostMemberKey: string | null
  hostUserId: string | null
  maxMembers: number
  memberCount: number
}

export function useRoomParty(
  roomId: string,
  memberKey: string,
  membershipReady: boolean,
  realtimeConnected: boolean,
  channel: RealtimeChannel | null,
) {
  const [state, setState] = useState<RoomPartyState | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !roomId) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data, error } = await supabase.rpc('get_room_party_state', { p_room_id: roomId })
    if (error || !data || !Array.isArray(data) || data.length === 0) return
    const row = data[0] as {
      host_member_key: string | null
      host_user_id: string | null
      max_members: number
      member_count: number
    }
    setState({
      hostMemberKey: row.host_member_key,
      hostUserId: row.host_user_id,
      maxMembers: row.max_members,
      memberCount: row.member_count,
    })
  }, [roomId])

  useEffect(() => {
    if (!membershipReady) return
    void refresh()
  }, [membershipReady, refresh])

  useEffect(() => {
    if (!channel || !membershipReady) return
    let active = true
    const handler = () => {
      if (active) void refresh()
    }
    channel.on('broadcast', { event: 'party_state' }, handler)
    return () => {
      active = false
    }
  }, [channel, membershipReady, refresh])

  useEffect(() => {
    if (!channel || !membershipReady || !realtimeConnected) return
    void channel.send({ type: 'broadcast', event: 'party_state', payload: { at: Date.now() } })
  }, [channel, membershipReady, realtimeConnected])

  const broadcastPartyRefresh = useCallback(async () => {
    if (!channel) return
    await channel.send({ type: 'broadcast', event: 'party_state', payload: { at: Date.now() } })
  }, [channel])

  const transferHost = useCallback(
    async (newHostMemberKey: string) => {
      if (!isSupabaseConfigured || !roomId) return { ok: false as const, error: 'Not configured.' }
      const supabase = getSupabase()
      if (!supabase) return { ok: false as const, error: 'No client.' }
      setTransferError(null)
      const { error } = await supabase.rpc('transfer_room_host', {
        p_room_id: roomId,
        p_actor_member_key: memberKey,
        p_new_host_member_key: newHostMemberKey,
      })
      if (error) {
        setTransferError(error.message)
        return { ok: false as const, error: error.message }
      }
      await refresh()
      await broadcastPartyRefresh()
      return { ok: true as const }
    },
    [roomId, memberKey, refresh, broadcastPartyRefresh],
  )

  const isHost = state?.hostMemberKey === memberKey

  return {
    party: state,
    isHost,
    transferError,
    transferHost,
    refreshParty: refresh,
    broadcastPartyRefresh,
  }
}
