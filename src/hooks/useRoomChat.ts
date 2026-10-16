import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { CHAT_MAX_LENGTH, type RoomMessage } from '../types/chat'

function normalizeRow(row: RoomMessage): RoomMessage {
  return {
    id: row.id,
    room_id: row.room_id,
    member_key: row.member_key,
    nickname: row.nickname,
    body: row.body,
    created_at: row.created_at,
  }
}

function mergeMessages(prev: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  const map = new Map<string, RoomMessage>()
  for (const m of prev) map.set(m.id, m)
  for (const m of incoming) map.set(m.id, normalizeRow(m))
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

type UseRoomChatArgs = {
  roomId: string
  nickname: string
  memberKey: string
  channel: RealtimeChannel | null
  /** Membership verified (room join) — load history */
  membershipReady: boolean
  /** Realtime channel subscribed — live broadcast + send */
  realtimeConnected: boolean
}

export function useRoomChat({
  roomId,
  nickname,
  memberKey,
  channel,
  membershipReady,
  realtimeConnected,
}: UseRoomChatArgs) {
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const seenIds = useRef(new Set<string>())

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const appendMessage = useCallback(
    (msg: RoomMessage) => {
      if (seenIds.current.has(msg.id)) return
      seenIds.current.add(msg.id)
      setMessages((prev) => mergeMessages(prev, [msg]))
      requestAnimationFrame(scrollToBottom)
    },
    [scrollToBottom],
  )

  useEffect(() => {
    if (!membershipReady || !isSupabaseConfigured || !roomId || !memberKey) return

    const supabase = getSupabase()
    if (!supabase) return

    let cancelled = false
    setLoadingHistory(true)
    setError(null)

    void (async () => {
      const { data, error: rpcErr } = await supabase.rpc('fetch_room_messages', {
        p_room_id: roomId,
        p_member_key: memberKey,
        p_limit: 150,
      })
      if (cancelled) return
      if (rpcErr) {
        setError(rpcErr.message)
        setLoadingHistory(false)
        return
      }
      const rows = (data ?? []) as RoomMessage[]
      for (const r of rows) seenIds.current.add(r.id)
      setMessages(mergeMessages([], rows))
      requestAnimationFrame(scrollToBottom)
      setLoadingHistory(false)
    })()

    return () => {
      cancelled = true
    }
  }, [roomId, memberKey, membershipReady, scrollToBottom])

  useEffect(() => {
    if (!channel || !realtimeConnected) return

    const handler = (payload: { payload: RoomMessage }) => {
      if (payload.payload?.room_id !== roomId) return
      appendMessage(normalizeRow(payload.payload))
    }

    let active = true
    const wrapped = (payload: { payload: RoomMessage }) => {
      if (!active) return
      handler(payload)
    }
    channel.on('broadcast', { event: 'chat_message' }, wrapped)

    return () => {
      active = false
    }
  }, [channel, roomId, realtimeConnected, appendMessage])

  const sendMessage = useCallback(
    async (raw: string) => {
      const body = raw.trim()
      if (!body) return { ok: false as const, error: 'Message cannot be empty.' }
      if (body.length > CHAT_MAX_LENGTH) {
        return { ok: false as const, error: `Message must be ${CHAT_MAX_LENGTH} characters or fewer.` }
      }
      if (!membershipReady || !isSupabaseConfigured) {
        return { ok: false as const, error: 'Chat is not available until you have joined the room.' }
      }
      if (!realtimeConnected || !channel) {
        return { ok: false as const, error: 'Realtime is not connected. Wait or refresh after Realtime is available.' }
      }

      const supabase = getSupabase()
      if (!supabase) return { ok: false as const, error: 'Supabase unavailable.' }

      setSending(true)
      setError(null)
      try {
        const { data, error: insertErr } = await supabase.rpc('post_room_message', {
          p_room_id: roomId,
          p_member_key: memberKey,
          p_nickname: nickname,
          p_body: body,
        })

        if (insertErr) {
          setError(insertErr.message)
          return { ok: false as const, error: insertErr.message }
        }

        const row = normalizeRow(data as RoomMessage)
        appendMessage(row)

        if (channel) {
          await channel.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: row,
          })
        }

        return { ok: true as const }
      } finally {
        setSending(false)
      }
    },
    [roomId, memberKey, nickname, membershipReady, realtimeConnected, channel, appendMessage],
  )

  return {
    messages,
    loadingHistory,
    sending,
    error,
    setError,
    sendMessage,
    listRef,
    scrollToBottom,
  }
}
