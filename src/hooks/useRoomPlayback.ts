import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { mapPlaybackRow, type PlaybackDbRow } from '../lib/playback/mapPlaybackRow'
import { mergePlaybackState, shouldApplyRevision } from '../lib/playback/syncEngine'
import { SerialTaskQueue, runWithStaleRetry } from '../lib/playback/playbackActionQueue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  EMPTY_PLAYBACK_STATE,
  PLAYBACK_BROADCAST_EVENT,
  type PlaybackActionType,
  type RoomPlaybackState,
} from '../shared/playback'

export type PlaybackDiagnostics = {
  driftMs: number | null
  lastEventLatencyMs: number | null
  syncStatus: 'synced' | 'correcting' | 'unknown'
  lastError: string | null
}

type ApplyActionPayload = Record<string, unknown> & { type: PlaybackActionType }

export function useRoomPlayback(
  roomId: string,
  memberKey: string,
  isHost: boolean,
  membershipReady: boolean,
  channel: RealtimeChannel | null,
  realtimeConnected: boolean,
) {
  const [state, setState] = useState<RoomPlaybackState>(() => EMPTY_PLAYBACK_STATE(roomId))
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [diag, setDiag] = useState<PlaybackDiagnostics>({
    driftMs: null,
    lastEventLatencyMs: null,
    syncStatus: 'unknown',
    lastError: null,
  })
  const applyingRemoteRef = useRef(false)
  const lastAppliedRevision = useRef(0)
  const lastAppliedActionId = useRef<string | null>(null)
  const revisionRef = useRef(0)
  const hostActionQueue = useRef(new SerialTaskQueue())

  const applyMappedState = useCallback((mapped: RoomPlaybackState) => {
    lastAppliedRevision.current = mapped.revision
    lastAppliedActionId.current = mapped.actionId
    revisionRef.current = mapped.revision
    setState(mapped)
  }, [])

  const refresh = useCallback(async (): Promise<RoomPlaybackState | null> => {
    if (!isSupabaseConfigured || !roomId || !memberKey) return null
    const supabase = getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase.rpc('get_room_playback_state', {
      p_room_id: roomId,
      p_member_key: memberKey,
    })
    if (error) {
      const msg = error.message ?? 'Playback state unavailable'
      setDiag((d) => ({
        ...d,
        lastError: msg.includes('get_room_playback_state') || msg.includes('schema cache')
          ? 'Playback RPC missing. Apply supabase/migrations/016_repair_proposals_and_playback.sql (or 015) in Supabase SQL Editor.'
          : msg,
      }))
      return null
    }
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as PlaybackDbRow) : undefined
    const mapped = mapPlaybackRow(row, roomId)
    applyMappedState(mapped)
    setDiag((d) => ({
      ...d,
      syncStatus: mapped.sourceType === 'none' ? 'unknown' : 'correcting',
    }))
    return mapped
  }, [roomId, memberKey, applyMappedState])

  useEffect(() => {
    void fetch('/api/time')
      .then((r) => r.json())
      .then((j: { serverMs?: number }) => {
        if (typeof j.serverMs === 'number') {
          setClockOffsetMs(j.serverMs - Date.now())
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!membershipReady) return
    void refresh()
  }, [membershipReady, refresh])

  useEffect(() => {
    if (!realtimeConnected || !membershipReady) return
    void refresh()
  }, [realtimeConnected, membershipReady, refresh])

  useEffect(() => {
    if (!channel || !membershipReady) return
    let active = true
    const handler = (raw: unknown) => {
      const payload = raw as { payload?: RoomPlaybackState & { sentAt?: number } }
      if (!active || !payload.payload) return
      const incoming = payload.payload
      if (
        incoming.revision < lastAppliedRevision.current ||
        (incoming.revision === lastAppliedRevision.current &&
          incoming.actionId === lastAppliedActionId.current)
      ) {
        return
      }
      if (!shouldApplyRevision(incoming.revision, lastAppliedRevision.current)) return
      applyingRemoteRef.current = true
      lastAppliedRevision.current = incoming.revision
      lastAppliedActionId.current = incoming.actionId ?? null
      revisionRef.current = incoming.revision
      setState((prev) => mergePlaybackState(prev, incoming))
      if (payload.payload.sentAt) {
        setDiag((d) => ({
          ...d,
          lastEventLatencyMs: Date.now() - payload.payload!.sentAt!,
          syncStatus: 'correcting',
        }))
      }
      window.setTimeout(() => {
        applyingRemoteRef.current = false
      }, 50)
    }
    ;(channel as { on: (t: string, f: object, cb: (p: unknown) => void) => void }).on(
      'broadcast',
      { event: PLAYBACK_BROADCAST_EVENT },
      handler as (p: unknown) => void,
    )
    return () => {
      active = false
    }
  }, [channel, membershipReady])

  const broadcastState = useCallback(
    async (next: RoomPlaybackState) => {
      if (!channel || !realtimeConnected) return
      await channel.send({
        type: 'broadcast',
        event: PLAYBACK_BROADCAST_EVENT,
        payload: { ...next, sentAt: Date.now() },
      })
    },
    [channel, realtimeConnected],
  )

  const applyHostAction = useCallback(
    (action: ApplyActionPayload) => {
      if (!isHost || !isSupabaseConfigured) {
        return Promise.resolve({ ok: false as const, error: 'Not host.' })
      }
      const supabase = getSupabase()
      if (!supabase) return Promise.resolve({ ok: false as const, error: 'No client.' })

      return hostActionQueue.current.enqueue(async () => {
        setLoading(true)
        const result = await runWithStaleRetry(
          () => revisionRef.current,
          async () => {
            const fresh = await refresh()
            return fresh?.revision ?? revisionRef.current
          },
          async (expectedRevision) => {
            const { data, error } = await supabase.rpc('apply_playback_action', {
              p_room_id: roomId,
              p_member_key: memberKey,
              p_action: { ...action, expectedRevision },
            })
            if (error) {
              const msg = error.message ?? 'Playback action failed'
              if (msg.includes('schema cache') || msg.includes('apply_playback_action')) {
                return {
                  ok: false as const,
                  error: 'Playback RPC missing. Apply migration 015/016 in Supabase.',
                }
              }
              return { ok: false as const, error: msg }
            }
            const row = data as PlaybackDbRow
            const mapped = mapPlaybackRow(row, roomId)
            return { ok: true as const, value: mapped }
          },
        )
        setLoading(false)
        if (!result.ok) {
          setDiag((d) => ({ ...d, lastError: result.error }))
          return result
        }
        applyMappedState(result.value)
        await broadcastState(result.value)
        setDiag((d) => ({ ...d, lastError: null }))
        return { ok: true as const, state: result.value }
      })
    },
    [isHost, roomId, memberKey, refresh, applyMappedState, broadcastState],
  )

  const reportDrift = useCallback((driftMs: number, syncStatus: PlaybackDiagnostics['syncStatus']) => {
    setDiag((d) => {
      if (d.driftMs === driftMs && d.syncStatus === syncStatus) return d
      return { ...d, driftMs, syncStatus }
    })
  }, [])

  return {
    state,
    clockOffsetMs,
    loading,
    diag,
    applyingRemote: applyingRemoteRef,
    refresh,
    applyHostAction,
    reportDrift,
    setState,
  }
}
