import { useRoomVoiceContext } from '../../room/RoomVoiceContext'

/** Compact voice controls — fixed corner, does not cover navigation or room UI. */
export function FloatingVoiceBar() {
  const { inVoice, status, micMuted, toggleMic, leaveVoice } = useRoomVoiceContext()

  if (!inVoice) return null

  const busy = status === 'connecting' || status === 'disconnecting'

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[52] flex max-w-[min(100vw-2rem,280px)] items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-2 shadow-lg backdrop-blur-md"
      role="region"
      aria-label="Voice call controls"
    >
      <span className="text-[10px] font-medium text-[var(--color-muted)]">
        {status === 'connected' ? 'In voice' : 'Voice…'}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={toggleMic}
        className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {micMuted ? 'Unmute' : 'Mute'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void leaveVoice()}
        className="rounded-md border border-red-500/50 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
      >
        Leave
      </button>
    </div>
  )
}
