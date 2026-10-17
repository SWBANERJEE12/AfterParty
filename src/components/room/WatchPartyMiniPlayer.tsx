type Props = {
  roomId: string
  title: string | null
  syncLabel: string
  status: string
  isHost: boolean
  canControl: boolean
  membershipReady?: boolean
  connected?: boolean
  onTogglePlay: () => void
  onExpand: () => void
  onLeave: () => void
}

export function WatchPartyMiniPlayer({
  roomId,
  title,
  syncLabel,
  status,
  isHost,
  canControl,
  membershipReady = true,
  connected = false,
  onTogglePlay,
  onExpand,
  onLeave,
}: Props) {
  const truthfulSync =
    !membershipReady ? 'Joining room…' : connected ? syncLabel : syncLabel || 'Disconnected'
  const roomLabel = roomId ? roomId : '—'
  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[55] flex w-[min(100vw-2rem,320px)] flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-2xl backdrop-blur-md"
      role="region"
      aria-label="Watch party mini player"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--color-fg)]">
            {title ?? 'Watch party'}
          </p>
          <p className="font-mono text-[10px] text-[var(--color-muted)]">{roomLabel}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {truthfulSync} · {status}
            {isHost ? ' · Host' : ''}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-[#FE4401] px-2 py-1 text-[10px] font-semibold text-white"
          onClick={onExpand}
        >
          Expand
        </button>
      </div>
      <div className="flex gap-2">
        {canControl && (
          <button
            type="button"
            className="flex-1 rounded-md border border-[var(--color-border)] py-1.5 text-xs"
            onClick={onTogglePlay}
          >
            {status === 'playing' ? 'Pause' : 'Play'}
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300"
          onClick={onLeave}
        >
          Leave
        </button>
      </div>
    </div>
  )
}
