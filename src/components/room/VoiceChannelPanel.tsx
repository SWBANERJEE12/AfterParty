import { useState } from 'react'
import { useRoomVoiceContext } from '../../room/RoomVoiceContext'
import { colorForSlot } from '../../shared/avatarColors'

type Props = {
  roomReady: boolean
  hostMemberKey: string | null
  isHost: boolean
  transferError: string | null
  onTransferHost: (newHostMemberKey: string) => Promise<{ ok: boolean }>
}

function AvatarInitial({ name, slot }: { name: string; slot: number }) {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  const bg = colorForSlot(slot)
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {letter}
    </div>
  )
}

export function VoiceChannelPanel({ roomReady, hostMemberKey, isHost, transferError, onTransferHost }: Props) {
  const {
    status,
    error,
    inVoice,
    micMuted,
    joinVoice,
    leaveVoice,
    toggleMic,
    setLocalVolume,
    setLocalMuted,
    memberViews,
  } = useRoomVoiceContext()

  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const busy = status === 'connecting' || status === 'disconnecting'

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="Voice channel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">Voice</h2>
        <span className="text-[10px] text-[var(--color-muted)]">
          {inVoice ? (status === 'connected' ? 'Connected' : 'Connecting…') : 'Not in voice'}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-[var(--color-muted)]">Audio only · up to 10 in room</p>

      {(error || transferError) && (
        <p className="mt-2 rounded-md border border-red-500/30 bg-red-950/30 px-2 py-1.5 text-xs text-red-200" role="alert">
          {error ?? transferError}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {memberViews.map((m, index) => {
          const speaking = m.speaking && !m.micMuted
          const showControls = expandedKey === m.memberKey
          return (
            <li
              key={m.memberKey}
              className={`relative rounded-lg border px-3 py-2 transition ${
                speaking
                  ? 'border-[var(--color-accent)]/70 bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)]'
              }`}
              onMouseEnter={() => setExpandedKey(m.memberKey)}
              onMouseLeave={() => setExpandedKey((k) => (k === m.memberKey ? null : k))}
            >
              <div className="flex items-center gap-3">
                <AvatarInitial name={m.nickname} slot={index} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--color-fg)]">
                    {m.nickname}
                    {m.isSelf ? ' (you)' : ''}
                    {hostMemberKey && m.memberKey === hostMemberKey && (
                      <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                        Host
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {m.inVoice ? (m.micMuted ? 'Muted' : speaking ? 'Speaking' : 'In voice') : 'Not in voice'}
                  </p>
                </div>
                {m.isSelf && (
                  <button
                    type="button"
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg)] md:hidden"
                    onClick={() => setExpandedKey(m.memberKey)}
                    aria-expanded={showControls}
                  >
                    Controls
                  </button>
                )}
              </div>

              {(showControls || (m.isSelf && expandedKey === m.memberKey)) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-2">
                  {m.isSelf ? (
                    <>
                      <button
                        type="button"
                        onClick={toggleMic}
                        disabled={!inVoice}
                        className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                      >
                        {micMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <span className="text-[10px] text-[var(--color-muted)]">{inVoice ? 'Mic live' : 'Join voice first'}</span>
                    </>
                  ) : (
                    <>
                      {isHost && (
                        <button
                          type="button"
                          className="rounded-md border border-amber-500/40 px-2 py-1 text-[10px] text-amber-100"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Transfer host to ${m.nickname}? They must be signed in.`,
                              )
                            ) {
                              void onTransferHost(m.memberKey)
                            }
                          }}
                        >
                          Make host
                        </button>
                      )}
                      <label className="flex flex-1 items-center gap-2 text-[10px] text-[var(--color-muted)]">
                        Volume
                        <input
                          type="range"
                          min={0}
                          max={100}
                          defaultValue={100}
                          className="flex-1 accent-[var(--color-accent)]"
                          onChange={(e) => setLocalVolume(m.memberKey, Number(e.target.value) / 100)}
                          aria-label={`Volume for ${m.nickname}`}
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px]"
                        onClick={() => setLocalMuted(m.memberKey, true)}
                      >
                        Mute locally
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px]"
                        onClick={() => {
                          setLocalMuted(m.memberKey, false)
                          setLocalVolume(m.memberKey, 1)
                        }}
                      >
                        Unmute locally
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex gap-2">
        {!inVoice ? (
          <button
            type="button"
            disabled={!roomReady || busy}
            onClick={() => void joinVoice()}
            className="flex-1 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Connecting…' : 'Join voice'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void leaveVoice()}
            className="flex-1 rounded-lg border border-red-500/50 py-2 text-sm font-medium text-red-300"
          >
            Leave voice
          </button>
        )}
      </div>
    </section>
  )
}
