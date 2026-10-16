import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getOrCreateMemberKey, setStoredNickname } from '../lib/session'
import { getSupabase, isSupabaseConfigured, verifySupabaseConnection } from '../lib/supabase'

export type Participant = {
  memberKey: string
  nickname: string
  online: boolean
}

export type RealtimeStatus = 'idle' | 'joining' | 'connected' | 'error' | 'reconnecting'

type PresencePayload = {
  member_key: string
  nickname: string
}

const MAX_RECONNECT_ATTEMPTS = 4

export type UseWatchRoomOptions = {
  /** When false, unmount does not call leave_room_member (persistent session). */
  leaveOnUnmount?: boolean
}

export async function leaveRoomMember(roomId: string, memberKey: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase || !isSupabaseConfigured) return
  await supabase.rpc('leave_room_member', {
    p_room_id: roomId,
    p_member_key: memberKey,
  })
}

export function useWatchRoom(
  roomId: string,
  nickname: string,
  options: UseWatchRoomOptions = {},
) {
  const leaveOnUnmount = options.leaveOnUnmount !== false
  const [participants, setParticipants] = useState<Participant[]>([])
  const [connected, setConnected] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle')
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backendReady, setBackendReady] = useState(false)
  const [membershipReady, setMembershipReady] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null)
  const memberKey = useRef(getOrCreateMemberKey())
  const joinedDbRef = useRef(false)
  const reconnectAttempt = useRef(0)
  const reconnectTimer = useRef<number | undefined>(undefined)

  const syncPresence = useCallback((channel: RealtimeChannel) => {
    const state = channel.presenceState<PresencePayload>()
    const list: Participant[] = []
    for (const presences of Object.values(state)) {
      for (const p of presences) {
        list.push({
          memberKey: p.member_key,
          nickname: p.nickname,
          online: true,
        })
      }
    }
    const selfKey = memberKey.current
    if (!list.some((p) => p.memberKey === selfKey)) {
      list.push({ memberKey: selfKey, nickname, online: true })
    }
    const deduped = new Map<string, Participant>()
    for (const p of list) deduped.set(p.memberKey, p)
    setParticipants([...deduped.values()].sort((a, b) => a.nickname.localeCompare(b.nickname)))
  }, [nickname])

  useEffect(() => {
    if (!roomId.trim()) {
      setParticipants([{ memberKey: memberKey.current, nickname, online: false }])
      setBackendReady(false)
      setMembershipReady(false)
      setRealtimeStatus('idle')
      setPresenceChannel(null)
      setConnected(false)
      setError(null)
      return
    }

    if (!isSupabaseConfigured) {
      setParticipants([{ memberKey: memberKey.current, nickname, online: false }])
      setBackendReady(false)
      setMembershipReady(false)
      setRealtimeStatus('idle')
      return
    }

    const supabase = getSupabase()
    if (!supabase) return

    let cancelled = false

    const teardownChannel = () => {
      if (channelRef.current) {
        void channelRef.current.untrack()
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setPresenceChannel(null)
      setConnected(false)
    }

    const attachRealtime = () => {
      if (cancelled) return

      teardownChannel()
      setRealtimeStatus(reconnectAttempt.current > 0 ? 'reconnecting' : 'joining')
      setRealtimeError(null)

      const channel = supabase.channel(`watch:${roomId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: memberKey.current },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => syncPresence(channel))
        .on('presence', { event: 'join' }, () => syncPresence(channel))
        .on('presence', { event: 'leave' }, () => syncPresence(channel))

      channel.subscribe(async (status, err) => {
        if (cancelled) return

        if (status === 'SUBSCRIBED') {
          reconnectAttempt.current = 0
          setRealtimeStatus('connected')
          setConnected(true)
          setRealtimeError(null)
          const trackStatus = await channel.track({
            member_key: memberKey.current,
            nickname,
          } as PresencePayload)
          if (trackStatus !== 'ok') {
            setRealtimeStatus('error')
            setConnected(false)
            setRealtimeError('Could not publish presence to the room channel.')
            return
          }
          syncPresence(channel)
          return
        }

        if (status === 'CHANNEL_ERROR') {
          setRealtimeStatus('error')
          setConnected(false)
          const detail = err?.message ?? 'Check Supabase Realtime is enabled for this project.'
          setRealtimeError(detail)
          scheduleReconnect()
          return
        }

        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('reconnecting')
          setConnected(false)
          scheduleReconnect()
        }
      })

      channelRef.current = channel
      setPresenceChannel(channel)
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectAttempt.current >= MAX_RECONNECT_ATTEMPTS) {
        if (reconnectAttempt.current >= MAX_RECONNECT_ATTEMPTS) {
          setRealtimeError(
            (prev) =>
              prev ??
              'Realtime could not reconnect. Refresh the page or confirm Realtime is enabled in Supabase.',
          )
        }
        return
      }
      reconnectAttempt.current += 1
      const delayMs = Math.min(1000 * 2 ** reconnectAttempt.current, 12000)
      window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = window.setTimeout(() => {
        if (!cancelled) attachRealtime()
      }, delayMs)
    }

    const setup = async () => {
      setError(null)
      setBackendReady(false)
      setMembershipReady(false)
      setRealtimeStatus('idle')

      const verify = await verifySupabaseConnection()
      if (cancelled) return
      if (verify.state === 'error') {
        setError(`Supabase connection failed: ${verify.message}`)
        return
      }
      if (verify.state === 'misconfigured') {
        setError('Supabase is not configured.')
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id ?? null

      let roomFound = false
      if (authUserId) {
        const { data: exists, error: existsErr } = await supabase.rpc('check_room_exists', {
          p_room_id: roomId,
        })
        if (cancelled) return
        if (existsErr) {
          setError(existsErr.message)
          return
        }
        roomFound = Boolean(exists)
      } else {
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('id')
          .eq('id', roomId)
          .maybeSingle()
        if (cancelled) return
        if (roomErr) {
          setError(roomErr.message)
          return
        }
        roomFound = Boolean(room)
      }

      if (!roomFound) {
        setError('Room not found. Check your invite link or code.')
        return
      }

      const joinNickname = nickname.trim()
      if (!joinNickname) {
        setError('Enter a nickname before joining (watch party create/join screen).')
        return
      }

      const { data: joinData, error: memberErr } = await supabase.rpc('join_room_member', {
        p_room_id: roomId,
        p_nickname: joinNickname,
        p_member_key: memberKey.current,
      })
      if (memberErr) {
        const msg = memberErr.message ?? 'Could not join room.'
        if (memberErr.code === '53400' || msg.toLowerCase().includes('room is full')) {
          setError('This room is full (maximum 10 participants).')
          return
        }
        if (memberErr.code === '23505' || msg.toLowerCase().includes('nickname')) {
          setError('That nickname is already in use in this room.')
          return
        }
        if (memberErr.code === 'P0002' || msg.toLowerCase().includes('room not found')) {
          setError('Room not found. Check your invite link or code.')
          return
        }
        if (msg.includes('join_room_member') || msg.includes('schema cache')) {
          setError('Room join RPC missing. Apply migration 014_room_core_host_cap.sql in Supabase.')
          return
        }
        setError(msg)
        return
      }

      const canonical =
        joinData && typeof joinData === 'object' && 'nickname' in joinData
          ? String((joinData as { nickname?: string }).nickname ?? '').trim()
          : ''
      if (canonical) setStoredNickname(canonical)

      if (cancelled) return
      joinedDbRef.current = true
      setMembershipReady(true)
      setBackendReady(true)
      attachRealtime()
    }

    void setup()

    return () => {
      cancelled = true
      window.clearTimeout(reconnectTimer.current)
      if (joinedDbRef.current && leaveOnUnmount) {
        joinedDbRef.current = false
        void leaveRoomMember(roomId, memberKey.current)
      }
      teardownChannel()
      if (leaveOnUnmount) {
        setRealtimeStatus('idle')
        setBackendReady(false)
        setMembershipReady(false)
      }
    }
  }, [roomId, nickname, syncPresence, leaveOnUnmount])

  return {
    participants,
    connected,
    realtimeStatus,
    realtimeError,
    error,
    backendReady,
    membershipReady,
    memberKey: memberKey.current,
    presenceChannel,
    isSupabaseConfigured,
  }
}

export async function createRoomInSupabase(roomId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured.' }
  }
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' }

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id

  if (userId) {
    const { error } = await supabase.from('rooms').insert({
      id: roomId,
      created_by: userId,
      max_members: 10,
    })
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Room already exists. Try again.' }
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  const { error } = await supabase.from('rooms').insert({ id: roomId, max_members: 10 })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Room already exists. Try again.' }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function roomExists(roomId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const supabase = getSupabase()
  if (!supabase) return false

  const { data: authData } = await supabase.auth.getUser()
  if (authData.user?.id) {
    const { data, error } = await supabase.rpc('check_room_exists', { p_room_id: roomId })
    if (error) return false
    return Boolean(data)
  }

  const { data } = await supabase.from('rooms').select('id').eq('id', roomId).maybeSingle()
  return Boolean(data)
}
