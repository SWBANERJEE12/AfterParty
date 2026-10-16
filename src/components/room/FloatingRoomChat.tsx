import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { RoomChatPanel } from './RoomChatPanel'

type Props = {
  roomId: string
  nickname: string
  memberKey: string
  channel: RealtimeChannel | null
  membershipReady: boolean
  realtimeConnected: boolean
  realtimeStatus: string
}

export function FloatingRoomChat({
  roomId,
  nickname,
  memberKey,
  channel,
  membershipReady,
  realtimeConnected,
  realtimeStatus,
}: Props) {
  const [open, setOpen] = useState(false)
  const lastReadCount = useRef(0)
  const [messageCount, setMessageCount] = useState(0)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (open) {
      lastReadCount.current = messageCount
      setUnread(0)
      return
    }
    if (messageCount > lastReadCount.current) {
      setUnread(messageCount - lastReadCount.current)
    }
  }, [messageCount, open])

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex max-h-[min(70vh,420px)] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
          role="dialog"
          aria-label="Room chat"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <span className="text-sm font-semibold text-[var(--color-fg)]">Chat</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              aria-label="Close chat"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <RoomChatPanel
              roomId={roomId}
              nickname={nickname}
              memberKey={memberKey}
              channel={channel}
              membershipReady={membershipReady}
              realtimeConnected={realtimeConnected}
              realtimeStatus={realtimeStatus}
              compact
              onMessageCount={setMessageCount}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-lg font-bold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
      >
        {open ? '×' : '💬'}
        {!open && unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[var(--color-accent)]"
            aria-live="polite"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  )
}
