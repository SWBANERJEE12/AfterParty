import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { VoiceChannelPanel } from '../components/room/VoiceChannelPanel'
import { roomInviteUrl } from '../lib/roomId'
import { isSupabaseConfigured } from '../lib/supabase'
import { PLAYER_MOUNT_ID } from '../room/RoomSessionShell'
import { useStoredNickname } from '../hooks/useStoredNickname'
import { useRoomSession } from '../room/RoomSessionContext'
import { useRoomSessionData } from '../room/RoomSessionDataContext'

export function WatchRoomPage() {
  const { roomId = '' } = useParams()
  const { enterRoom, minimizeRoom, leaveRoom, expandRoom } = useRoomSession()
  const data = useRoomSessionData()
  const { stored: nicknameStored } = useStoredNickname()
  const navigate = useNavigate()
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (roomId) {
      enterRoom(roomId)
      expandRoom()
    }
  }, [roomId, enterRoom, expandRoom])

  const party = data?.party ?? null
  const isHost = data?.isHost ?? false
  const connected = data?.connected ?? false
  const realtimeStatus = data?.realtimeStatus ?? 'idle'
  const realtimeError = data?.realtimeError
  const error = data?.error
  const membershipReady = data?.membershipReady ?? false
  const supabaseReady = isSupabaseConfigured
  const sessionJoined = Boolean(data?.membershipReady)
  const proposals = data?.proposals ?? []
  const transferError = data?.transferError ?? null
  const transferHost = data?.transferHost
  const broadcastPartyRefresh = data?.broadcastPartyRefresh

  const inviteLink = roomId ? roomInviteUrl(roomId) : ''

  const copyText = async (text: string, which: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === 'link') {
        setCopiedLink(true)
        window.setTimeout(() => setCopiedLink(false), 2000)
      } else {
        setCopiedCode(true)
        window.setTimeout(() => setCopiedCode(false), 2000)
      }
    } catch {
      if (which === 'link') setCopiedLink(false)
      else setCopiedCode(false)
    }
  }

  const handleTransferHost = useCallback(
    async (newHostMemberKey: string) => {
      if (!transferHost) return { ok: false as const, error: 'Room session not ready.' }
      const res = await transferHost(newHostMemberKey)
      if (res.ok) await broadcastPartyRefresh?.()
      return res
    },
    [transferHost, broadcastPartyRefresh],
  )

  return (
    <div className="afterparty-gradient flex min-h-dvh w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="text-lg font-semibold text-[var(--color-fg)]">
            Afterparty
          </Link>
          <button
            type="button"
            onClick={() => {
              minimizeRoom()
              navigate('/discover')
            }}
            className="text-xs text-[var(--color-muted)] transition hover:text-[var(--color-accent)]"
          >
            Discover
          </button>
          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-xs text-[var(--color-muted)]">
            {roomId}
          </span>
          <button
            type="button"
            onClick={() => void copyText(roomId, 'code')}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition hover:border-[var(--color-accent)]"
          >
            {copiedCode ? 'Code copied!' : 'Copy room code'}
          </button>
          <button
            type="button"
            onClick={() => void copyText(inviteLink, 'link')}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition hover:border-[var(--color-accent)]"
          >
            {copiedLink ? 'Link copied!' : 'Copy invite link'}
          </button>
          <button
            type="button"
            onClick={() => leaveRoom()}
            className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300"
          >
            Leave room
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {party && (
            <span className="text-[var(--color-muted)]">
              {party.memberCount}/{party.maxMembers} in room
              {isHost ? ' · You are host' : ''}
            </span>
          )}
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-500' : realtimeStatus === 'error' ? 'bg-red-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-[var(--color-muted)]">
              {!supabaseReady
                ? 'Supabase not configured'
                : !sessionJoined
                  ? 'Joining room…'
                  : connected
                    ? 'Presence live'
                    : realtimeStatus === 'reconnecting'
                      ? 'Realtime reconnecting…'
                      : realtimeStatus === 'error'
                        ? 'Realtime error'
                        : 'Connecting presence…'}
            </span>
          </span>
        </div>
      </header>

      {!supabaseReady && (
        <div className="border-b border-amber-500/20 bg-amber-950/15 px-4 py-2 text-center text-xs text-amber-100/80">
          Add <code className="text-amber-200/90">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-amber-200/90">VITE_SUPABASE_ANON_KEY</code> (or publishable key) to your{' '}
          <code className="text-amber-200/90">.env</code> / <code className="text-amber-200/90">.env.local</code>,
          then restart the dev server.
        </div>
      )}

      {supabaseReady && !nicknameStored && (
        <div className="border-b border-amber-500/30 bg-amber-950/20 px-4 py-2 text-center text-xs text-amber-100/90">
          Set your nickname via watch party create/join — it is required to join this room.
        </div>
      )}

      {supabaseReady && nicknameStored && !sessionJoined && !error && (
        <div className="border-b border-[var(--color-border)] px-4 py-2 text-center text-xs text-[var(--color-muted)]">
          Connecting to room services…
        </div>
      )}

      {error && (
        <div className="border-b border-red-500/30 bg-red-950/20 px-4 py-2 text-center text-sm text-red-200">
          {error}
        </div>
      )}

      {realtimeError && !error && (
        <div className="border-b border-red-500/30 bg-red-950/20 px-4 py-2 text-center text-sm text-red-200">
          Realtime: {realtimeError}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-6">
        <div id={PLAYER_MOUNT_ID} className="flex min-h-0 flex-1 flex-col" />

        <aside className="flex w-full flex-col gap-4 lg:w-80 xl:w-96">
          <VoiceChannelPanel
            roomReady={membershipReady && supabaseReady}
            hostMemberKey={party?.hostMemberKey ?? null}
            isHost={isHost}
            transferError={transferError}
            onTransferHost={handleTransferHost}
          />

          {proposals.length > 0 && (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Room shortlist</h2>
              <ul className="mt-2 space-y-2">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2"
                  >
                    {p.poster_url && (
                      <img src={p.poster_url} alt="" className="h-12 w-8 rounded object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--color-fg)]">{p.title}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">by {p.nickname}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
