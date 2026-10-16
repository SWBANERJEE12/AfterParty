import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import { formatPlaybackTime } from '../../lib/playback/formatPlaybackTime'

type Props = {
  durationSec: number
  positionSec: number
  previewSec?: number | null
  disabled: boolean
  onCommitSeek: (sec: number) => void
  onSkipBack: () => void
  onSkipForward: () => void
  readOnly?: boolean
}

export function PlaybackTimeline({
  durationSec,
  positionSec,
  previewSec,
  disabled,
  onCommitSeek,
  onSkipBack,
  onSkipForward,
  readOnly = false,
}: Props) {
  const labelId = useId()
  const draggingRef = useRef(false)
  const [dragSec, setDragSec] = useState<number | null>(null)
  const max = durationSec > 0 ? durationSec : 1
  const shown = dragSec ?? previewSec ?? positionSec
  const ratio = Math.min(1, Math.max(0, shown / max))

  const commit = useCallback(
    (sec: number) => {
      if (disabled || readOnly || !Number.isFinite(durationSec) || durationSec <= 0) return
      onCommitSeek(Math.max(0, Math.min(durationSec, sec)))
    },
    [disabled, readOnly, durationSec, onCommitSeek],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onSkipBack()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSkipForward()
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative h-2 w-full rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#FE4401]/80"
          style={{ width: `${ratio * 100}%` }}
          aria-hidden
        />
        {dragSec != null && (
          <div
            className="pointer-events-none absolute -top-7 rounded bg-black/80 px-2 py-0.5 text-[10px] text-white"
            style={{ left: `calc(${ratio * 100}% - 1.5rem)` }}
          >
            {formatPlaybackTime(dragSec)}
          </div>
        )}
      </div>
      <input
        type="range"
        aria-labelledby={labelId}
        min={0}
        max={max}
        step={0.25}
        disabled={disabled || readOnly || durationSec <= 0}
        value={Math.min(shown, max)}
        className="relative z-10 -mt-2 w-full cursor-pointer appearance-none bg-transparent accent-[#FE4401] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE4401]/60 disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FE4401]"
        onKeyDown={onKeyDown}
        onPointerDown={() => {
          if (readOnly) return
          draggingRef.current = true
        }}
        onPointerUp={(e) => {
          if (!draggingRef.current || readOnly) return
          draggingRef.current = false
          const sec = Number(e.currentTarget.value)
          setDragSec(null)
          commit(sec)
        }}
        onPointerCancel={() => {
          draggingRef.current = false
          setDragSec(null)
        }}
        onChange={(e) => {
          if (readOnly) return
          const sec = Number(e.target.value)
          if (draggingRef.current) setDragSec(sec)
        }}
      />
      <div id={labelId} className="flex justify-between text-[10px] text-[var(--color-muted)]">
        <span>{formatPlaybackTime(positionSec)}</span>
        <span>{formatPlaybackTime(durationSec)}</span>
      </div>
    </div>
  )
}
