import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { formatPlaybackTime } from '../../lib/playback/formatPlaybackTime'

type Props = {
  children: ReactNode
  durationSec: number
  positionSec: number
  disabled: boolean
  readOnly: boolean
  isPlaying: boolean
  isHost: boolean
  onCommitSeek: (sec: number) => void
  onSkipBack: () => void
  onSkipForward: () => void
  onTogglePlay: () => void
}

export function VideoPlayerChrome({
  children,
  durationSec,
  positionSec,
  disabled,
  readOnly,
  isPlaying,
  isHost,
  onCommitSeek,
  onSkipBack,
  onSkipForward,
  onTogglePlay,
}: Props) {
  const labelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [dragSec, setDragSec] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const hideTimer = useRef<number | undefined>(undefined)

  const bumpControls = useCallback(() => {
    setControlsVisible(true)
    window.clearTimeout(hideTimer.current)
    if (isPlaying && !draggingRef.current) {
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2800)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) setControlsVisible(true)
    else bumpControls()
    return () => window.clearTimeout(hideTimer.current)
  }, [isPlaying, bumpControls])

  const shown = dragSec ?? positionSec
  const max = durationSec > 0 ? durationSec : 1
  const ratio = Math.min(1, Math.max(0, shown / max))

  const commit = (sec: number) => {
    if (disabled || readOnly || durationSec <= 0) return
    onCommitSeek(Math.max(0, Math.min(durationSec, sec)))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isHost || disabled) return
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault()
      onTogglePlay()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onSkipBack()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSkipForward()
    }
  }

  const seekFromPointer = (clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    return (x / rect.width) * max
  }

  return (
    <div
      ref={rootRef}
      className="group relative aspect-video w-full bg-black"
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Video player"
    >
      {children}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12 transition-opacity duration-300 ${
          controlsVisible || !isPlaying || draggingRef.current ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="pointer-events-auto space-y-2">
          <div
            className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20"
            onPointerDown={(e) => {
              if (readOnly || disabled) return
              draggingRef.current = true
              const rect = e.currentTarget.getBoundingClientRect()
              setDragSec(seekFromPointer(e.clientX, rect))
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return
              const rect = e.currentTarget.getBoundingClientRect()
              setDragSec(seekFromPointer(e.clientX, rect))
            }}
            onPointerUp={(e) => {
              if (!draggingRef.current) return
              const rect = e.currentTarget.getBoundingClientRect()
              const sec = seekFromPointer(e.clientX, rect)
              draggingRef.current = false
              setDragSec(null)
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
              commit(sec)
              bumpControls()
            }}
            onPointerCancel={(e) => {
              draggingRef.current = false
              setDragSec(null)
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
            }}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#FE4401]" style={{ width: `${ratio * 100}%` }} />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#FE4401] shadow"
              style={{ left: `calc(${ratio * 100}% - 6px)` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isHost && (
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                onClick={onTogglePlay}
                disabled={disabled}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}
            {isHost && (
              <>
                <button type="button" className="text-xs text-white/90" onClick={onSkipBack} disabled={disabled}>
                  −10s
                </button>
                <button type="button" className="text-xs text-white/90" onClick={onSkipForward} disabled={disabled}>
                  +10s
                </button>
              </>
            )}
            <span id={labelId} className="ml-auto text-[10px] text-white/80">
              {formatPlaybackTime(positionSec)} / {formatPlaybackTime(durationSec)}
              {dragSec != null ? ` · ${formatPlaybackTime(dragSec)}` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
