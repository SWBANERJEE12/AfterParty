import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useRoomChat } from '../../hooks/useRoomChat'
import { CHAT_MAX_LENGTH } from '../../types/chat'

type Props = {
  roomId: string
  nickname: string
  memberKey: string
  channel: RealtimeChannel | null
  membershipReady: boolean
  realtimeConnected: boolean
  realtimeStatus: string
  compact?: boolean
  onMessageCount?: (count: number) => void
}

export function RoomChatPanel({
  roomId,
  nickname,
  memberKey,
  channel,
  membershipReady,
  realtimeConnected,
  realtimeStatus,
  compact = false,
  onMessageCount,
}: Props) {
  const [draft, setDraft] = useState('')
  const { messages, loadingHistory, sending, error, sendMessage, listRef } = useRoomChat({
    roomId,
    nickname,
    memberKey,
    channel,
    membershipReady,
    realtimeConnected,
  })

  useEffect(() => {
    onMessageCount?.(messages.length)
  }, [messages.length, onMessageCount])

  const onSend = async () => {
    const res = await sendMessage(draft)
    if (res.ok) setDraft('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void onSend()
    }
  }

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(iso),
      )
    } catch {
      return ''
    }
  }

  const canSend = membershipReady && realtimeConnected && !sending

  return (
    <section
      className={`flex flex-1 flex-col ${compact ? 'min-h-0' : 'min-h-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4'}`}
    >
      {!compact && (
        <>
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">Chat</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {membershipReady
              ? realtimeConnected
                ? 'Messages are saved for this room.'
                : `Realtime ${realtimeStatus} — history may load; sending needs a live connection.`
              : 'Joining room…'}
          </p>
        </>
      )}

      <div
        ref={listRef}
        className={`flex-1 space-y-3 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 p-3 ${compact ? 'min-h-[200px]' : 'mt-3'}`}
        aria-live="polite"
      >
        {loadingHistory && (
          <p className="text-xs text-[var(--color-muted)]">Loading chat history…</p>
        )}
        {!loadingHistory && messages.length === 0 && membershipReady && (
          <p className="text-xs text-[var(--color-muted)]">No messages yet. Say hello.</p>
        )}
        {!membershipReady && (
          <p className="text-xs text-[var(--color-muted)]">Chat unavailable until room membership is confirmed.</p>
        )}
        {messages.map((m) => {
          const mine = m.member_key === memberKey
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[95%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-fg)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-fg)]'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-baseline gap-2 text-[10px] text-[var(--color-muted)]">
                  <span className="font-medium text-[var(--color-fg)]/90">{m.nickname}</span>
                  <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LENGTH))}
          onKeyDown={onKeyDown}
          disabled={!canSend}
          placeholder={
            !membershipReady
              ? 'Joining room…'
              : !realtimeConnected
                ? 'Waiting for Realtime…'
                : 'Message…'
          }
          rows={2}
          className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/40 focus:ring-2 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!canSend || !draft.trim()}
          onClick={() => void onSend()}
          className="self-end rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
      <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
        {draft.length}/{CHAT_MAX_LENGTH}
      </p>
    </section>
  )
}
