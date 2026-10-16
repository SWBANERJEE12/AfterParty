import { useCallback, useEffect, useRef, useState } from 'react'
import { VideoPlayerChrome } from '../room/VideoPlayerChrome'
import { createYoutubePlayer, type YTPlayer } from '../../lib/playback/youtubePlayer'
import { TRAILER_UNAVAILABLE } from '../../lib/trailerMessages'

const YT_PLAYING = 1
const YT_PAUSED = 2

type Props = {
  open: boolean
  title: string
  year: string
  videoId: string | null
  loading: boolean
  error: string | null
  unavailableMessage: string | null
  onClose: () => void
  onEmbedFailure?: () => void
  onPropose?: () => void
  proposeDisabled?: boolean
  proposeHint?: string | null
}

export function TrailerModal({
  open,
  title,
  year,
  videoId,
  loading,
  error,
  unavailableMessage,
  onClose,
  onEmbedFailure,
  onPropose,
  proposeDisabled,
  proposeHint,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const playerHostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [positionSec, setPositionSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)

  const destroyPlayer = useCallback(() => {
    try {
      playerRef.current?.destroy()
    } catch {
      /* ignore */
    }
    playerRef.current = null
    setPlayerReady(false)
    setPositionSec(0)
    setDurationSec(0)
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !videoId || loading) {
      destroyPlayer()
      return
    }
    const host = playerHostRef.current
    if (!host) return

    let cancelled = false
    destroyPlayer()

    void createYoutubePlayer(host, videoId, {
      onReady: (player) => {
        if (cancelled) return
        playerRef.current = player
        setDurationSec(player.getDuration() || 0)
        setPlayerReady(true)
        player.playVideo()
        setIsPlaying(true)
      },
      onStateChange: (state) => {
        setIsPlaying(state === YT_PLAYING)
        if (state === YT_PAUSED || state === YT_PLAYING) {
          setPositionSec(playerRef.current?.getCurrentTime() ?? 0)
        }
      },
      onError: () => {
        onEmbedFailure?.()
      },
    })

    return () => {
      cancelled = true
      destroyPlayer()
    }
  }, [open, videoId, loading, destroyPlayer, onEmbedFailure])

  useEffect(() => {
    if (!open || !playerReady) return
    const id = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      setPositionSec(p.getCurrentTime())
      const d = p.getDuration()
      if (d > 0) setDurationSec(d)
    }, 250)
    return () => window.clearInterval(id)
  }, [open, playerReady])

  const handleClose = () => {
    destroyPlayer()
    onClose()
  }

  if (!open) return null

  const showUnavailable = !loading && !videoId
  const detail = error ?? unavailableMessage

  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) p.pauseVideo()
    else p.playVideo()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trailer-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close trailer"
        onClick={handleClose}
      />
      <div className="relative z-10 flex max-h-[min(96vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 md:px-5">
          <div className="min-w-0">
            <h2
              id="trailer-modal-title"
              className="truncate text-base font-semibold text-[var(--color-fg)] sm:text-lg"
            >
              {showUnavailable ? TRAILER_UNAVAILABLE : title}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {showUnavailable ? `${title} (${year})` : year}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition hover:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            Close
          </button>
        </div>

        <div className="bg-black">
          <VideoPlayerChrome
            durationSec={durationSec}
            positionSec={positionSec}
            disabled={!playerReady}
            readOnly={!playerReady}
            isPlaying={isPlaying}
            isHost={true}
            onCommitSeek={(sec) => playerRef.current?.seekTo(sec, true)}
            onSkipBack={() => playerRef.current?.seekTo(Math.max(0, positionSec - 10), true)}
            onSkipForward={() =>
              playerRef.current?.seekTo(Math.min(durationSec, positionSec + 10), true)
            }
            onTogglePlay={togglePlay}
          >
            <div className="relative aspect-video w-full bg-black">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
                  Finding trailer…
                </div>
              )}
              {!loading && videoId && <div ref={playerHostRef} className="absolute inset-0 h-full w-full" />}
              {showUnavailable && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-sm font-medium text-white/95">{TRAILER_UNAVAILABLE}</p>
                  {detail && <p className="text-xs text-white/70">{detail}</p>}
                </div>
              )}
            </div>
          </VideoPlayerChrome>
        </div>

        {(onPropose || proposeHint) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
            {onPropose && (
              <button
                type="button"
                disabled={proposeDisabled}
                onClick={onPropose}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Propose to room
              </button>
            )}
            {proposeHint && <p className="text-xs text-[var(--color-muted)]">{proposeHint}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
