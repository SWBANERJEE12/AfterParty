import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchMovieTrailer, searchOmdb } from '../../lib/api'
import {
  formatPlaybackStatusLabel,
  formatPlaybackSyncLabel,
} from '../../lib/playback/formatSyncLabel'
import { expectedPositionSec, isStaleAction, planDriftCorrection } from '../../lib/playback/syncEngine'
import { createYoutubePlayer, type YTPlayer } from '../../lib/playback/youtubePlayer'
import { useHostMediaWebRTC } from '../../hooks/useHostMediaWebRTC'
import { useRoomPlayback } from '../../hooks/useRoomPlayback'
import { useVideoPlaybackSync } from '../../hooks/useVideoPlaybackSync'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { MovieMeta } from '../../shared/movies'
import { PendingPlaybackBuffer } from '../../lib/playback/pendingPlaybackState'
import { DRIFT_HARD_MS } from '../../shared/playback'
import { VideoPlayerChrome } from './VideoPlayerChrome'

type Props = {
  roomId: string
  memberKey: string
  isHost: boolean
  hostMemberKey: string | null
  membershipReady: boolean
  realtimeConnected: boolean
  channel: RealtimeChannel | null
  proposalMovies?: MovieMeta[]
  onPlaybackBridge?: (bridge: {
    title: string | null
    status: string
    syncLabel: string
    isHost: boolean
    canControl: boolean
    togglePlay: () => void
  }) => void
}

export function SyncWatchPlayer({
  roomId,
  memberKey,
  isHost,
  hostMemberKey,
  membershipReady,
  realtimeConnected,
  channel,
  proposalMovies = [],
  onPlaybackBridge,
}: Props) {
  const playback = useRoomPlayback(
    roomId,
    memberKey,
    isHost,
    membershipReady,
    channel,
    realtimeConnected,
  )
  const { applyHostAction, refresh: refreshPlayback, reportDrift } = playback

  const applyHostActionRef = useRef(applyHostAction)
  applyHostActionRef.current = applyHostAction
  const refreshPlaybackRef = useRef(refreshPlayback)
  refreshPlaybackRef.current = refreshPlayback
  const reportDriftRef = useRef(reportDrift)
  reportDriftRef.current = reportDrift
  const playbackStateRef = useRef(playback.state)
  playbackStateRef.current = playback.state
  const clockOffsetRef = useRef(playback.clockOffsetMs)
  clockOffsetRef.current = playback.clockOffsetMs

  const [sourceMode, setSourceMode] = useState<'trailer' | 'file'>('trailer')
  const [ytPlayerReady, setYtPlayerReady] = useState(false)
  const trailerLoadGenRef = useRef(0)
  useEffect(() => {
    return () => {
      trailerLoadGenRef.current += 1
      trailerLoadInFlightRef.current = false
    }
  }, [])
  const [hostMediaPreparing, setHostMediaPreparing] = useState(false)
  const [viewerSyncEnabled, setViewerSyncEnabled] = useState(false)
  const pendingPlaybackRef = useRef(new PendingPlaybackBuffer())
  const viewerInitializedRef = useRef(false)

  const media = useHostMediaWebRTC(
    channel,
    memberKey,
    isHost,
    hostMemberKey,
    playback.state.mediaSessionId,
    playback.state.sourceType,
    membershipReady && playback.state.sourceType === 'host_media',
    hostMediaPreparing,
    membershipReady,
  )

  const ytContainerRef = useRef<HTMLDivElement | null>(null)
  const [ytDomReady, setYtDomReady] = useState(false)
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const ytPlayerVideoIdRef = useRef<string | null>(null)
  const ytCreateGenRef = useRef(0)
  const ytBufferingRpcAtRef = useRef(0)
  const trailerLoadInFlightRef = useRef(false)
  const [ytError, setYtError] = useState<string | null>(null)
  const [selectingTrailer, setSelectingTrailer] = useState(false)
  const [trailerQuery, setTrailerQuery] = useState('')
  const lastActionRef = useRef({ revision: 0, actionId: null as string | null })
  const suppressLocalBroadcast = playback.applyingRemote
  const attachAfterRpcRef = useRef<{ sessionId: string; file: File } | null>(null)
  const publishedReadyForSessionRef = useRef<string | null>(null)

  const showHostVideo =
    isHost &&
    (playback.state.sourceType === 'host_media' || sourceMode === 'file' || hostMediaPreparing)

  const showViewerVideo = !isHost && playback.state.sourceType === 'host_media'

  useEffect(() => {
    if (!channel || !membershipReady || !isHost) return
    const handler = (raw: unknown) => {
      const msg = raw as { payload?: { imdbId?: string; title?: string; youtubeVideoId?: string } }
      const p = msg.payload
      if (!p?.youtubeVideoId) return
      void applyHostActionRef.current({
        type: 'select_source',
        sourceType: 'youtube_trailer',
        imdbId: p.imdbId,
        movieTitle: p.title,
        youtubeVideoId: p.youtubeVideoId,
        mediaSessionId: crypto.randomUUID(),
      })
    }
    const ch = channel as {
      on: (t: string, f: object, cb: (p: unknown) => void) => void
      off?: (t: string, f: object, cb: (p: unknown) => void) => void
    }
    ch.on('broadcast', { event: 'play_proposed_trailer' }, handler as (p: unknown) => void)
    return () => {
      ch.off?.('broadcast', { event: 'play_proposed_trailer' }, handler as (p: unknown) => void)
    }
  }, [channel, membershipReady, isHost])

  useEffect(() => {
    publishedReadyForSessionRef.current = null
    lastActionRef.current = { revision: 0, actionId: null }
    viewerInitializedRef.current = false
    setViewerSyncEnabled(false)
    pendingPlaybackRef.current.clear()
  }, [playback.state.mediaSessionId])

  useEffect(() => {
    if (isHost || playback.state.sourceType !== 'host_media') return
    if (media.viewerFileLoadState === 'ready') return
    pendingPlaybackRef.current.update(playback.state)
  }, [isHost, playback.state, media.viewerFileLoadState])

  useEffect(() => {
    if (isHost || media.viewerFileLoadState !== 'ready' || viewerInitializedRef.current) return

    const runInit = async () => {
      const fresh = await refreshPlaybackRef.current()
      const buffered = pendingPlaybackRef.current.peek()
      const s =
        fresh && buffered && buffered.revision > fresh.revision
          ? buffered
          : (fresh ?? buffered ?? playbackStateRef.current)
      const expected = expectedPositionSec(s, Date.now(), clockOffsetRef.current)
      suppressLocalBroadcast.current = true
      media.applyViewerPlaybackToVideo('seek', expected, s.playbackRate)
      if (s.status === 'playing') {
        media.applyViewerPlaybackToVideo('play', expected, s.playbackRate)
      } else {
        media.applyViewerPlaybackToVideo('pause', expected, s.playbackRate)
      }
      lastActionRef.current = { revision: s.revision, actionId: s.actionId }
      pendingPlaybackRef.current.clear()
      viewerInitializedRef.current = true
      setViewerSyncEnabled(true)
      window.setTimeout(() => {
        suppressLocalBroadcast.current = false
      }, 150)
    }

    void runInit()
  }, [isHost, media.viewerFileLoadState, media, suppressLocalBroadcast])

  useEffect(() => {
    if (isHost) return
    const off = media.onViewerFileReady(() => {
      if (viewerInitializedRef.current) return
      void refreshPlaybackRef.current()
    })
    return () => {
      off()
    }
  }, [isHost, media])

  const loadTrailer = useCallback(
    async (movie: MovieMeta) => {
      if (!isHost || !movie.imdbId) return
      if (trailerLoadInFlightRef.current) return
      trailerLoadInFlightRef.current = true
      const loadGen = ++trailerLoadGenRef.current
      setSelectingTrailer(true)
      setYtError(null)
      let trailer
      try {
        trailer = await fetchMovieTrailer(movie.imdbId)
      } catch {
        if (loadGen === trailerLoadGenRef.current) {
          setSelectingTrailer(false)
          setYtError('Trailer lookup failed. Try again.')
        }
        trailerLoadInFlightRef.current = false
        return
      }
      if (loadGen !== trailerLoadGenRef.current) {
        trailerLoadInFlightRef.current = false
        return
      }
      setSelectingTrailer(false)
      if (!trailer.videoId) {
        setYtError(trailer.message ?? 'Trailer unavailable')
        trailerLoadInFlightRef.current = false
        return
      }
      const sessionId = crypto.randomUUID()
      const res = await applyHostAction({
        type: 'select_source',
        sourceType: 'youtube_trailer',
        imdbId: movie.imdbId,
        movieTitle: movie.title,
        youtubeVideoId: trailer.videoId,
        mediaSessionId: sessionId,
      })
      if (!res.ok && loadGen === trailerLoadGenRef.current) {
        setYtError(res.error)
      }
      trailerLoadInFlightRef.current = false
    },
    [isHost, applyHostAction],
  )

  const searchAndLoadTrailer = useCallback(async () => {
    if (!isHost || trailerLoadInFlightRef.current || selectingTrailer) return
    const q = trailerQuery.trim()
    if (!q) {
      setYtError('Enter a movie title or IMDb id (tt…)')
      return
    }
    setYtError(null)
    if (/^tt\d{7,}$/i.test(q)) {
      await loadTrailer({
        id: 0,
        imdbId: q.toLowerCase(),
        title: q,
        overview: '',
        posterUrl: null,
        releaseYear: '—',
        trailerYoutubeKey: null,
      })
      return
    }
    setSelectingTrailer(true)
    const { results, error } = await searchOmdb(q)
    setSelectingTrailer(false)
    if (error) {
      setYtError(error)
      return
    }
    const first = results.find((m) => m.imdbId)
    if (!first) {
      setYtError('No results — try another title')
      return
    }
    await loadTrailer(first)
  }, [isHost, trailerQuery, loadTrailer])

  useEffect(() => {
    const pending = attachAfterRpcRef.current
    if (!pending || !showHostVideo) return
    if (playback.state.sourceType !== 'host_media') return
    if (playback.state.mediaSessionId !== pending.sessionId) return
    attachAfterRpcRef.current = null
    media.prepareHostFile(pending.file)
  }, [playback.state.sourceType, playback.state.mediaSessionId, showHostVideo, media])

  useEffect(() => {
    const sid = playback.state.mediaSessionId
    if (
      playback.state.sourceType !== 'host_media' ||
      media.hostFileLoadState !== 'ready' ||
      !sid ||
      publishedReadyForSessionRef.current === sid
    ) {
      return
    }
    publishedReadyForSessionRef.current = sid
    const duration = media.hostDurationSec
    void applyHostAction({
      type: 'ready',
      positionSec: 0,
      status: 'paused',
      ...(duration != null ? { durationSec: duration } : {}),
    }).finally(() => setHostMediaPreparing(false))
  }, [
    applyHostAction,
    media.hostFileLoadState,
    media.hostDurationSec,
    playback.state.sourceType,
    playback.state.mediaSessionId,
  ])

  useEffect(() => {
    if (media.hostFileLoadState === 'error') setHostMediaPreparing(false)
  }, [media.hostFileLoadState])

  const onHostFile = useCallback(
    async (file: File) => {
      if (!isHost) return
      setYtError(null)
      setHostMediaPreparing(true)
      publishedReadyForSessionRef.current = null
      const sessionId = crypto.randomUUID()
      attachAfterRpcRef.current = { sessionId, file }
      const res = await applyHostAction({
        type: 'select_source',
        sourceType: 'host_media',
        mediaSessionId: sessionId,
      })
      if (!res.ok) {
        attachAfterRpcRef.current = null
        setHostMediaPreparing(false)
        setYtError(res.error)
      }
    },
    [isHost, applyHostAction],
  )

  const youtubeVideoId = playback.state.youtubeVideoId
  const youtubeSource = playback.state.sourceType === 'youtube_trailer'

  const bindYtContainer = useCallback((node: HTMLDivElement | null) => {
    ytContainerRef.current = node
    setYtDomReady(Boolean(node))
  }, [])

  useLayoutEffect(() => {
    if (!youtubeSource) {
      ytPlayerRef.current?.destroy()
      ytPlayerRef.current = null
      ytPlayerVideoIdRef.current = null
      setYtPlayerReady(false)
    }
  }, [youtubeSource])

  useEffect(() => {
    if (!youtubeSource || !youtubeVideoId || !ytDomReady) return
    const el = ytContainerRef.current
    if (!el) return

    if (ytPlayerVideoIdRef.current === youtubeVideoId && ytPlayerRef.current) {
      return
    }

    ytPlayerRef.current?.destroy()
    ytPlayerRef.current = null
    ytPlayerVideoIdRef.current = null
    setYtPlayerReady(false)

    const gen = ++ytCreateGenRef.current
    let cancelled = false

    void createYoutubePlayer(el, youtubeVideoId, {
      onError: (code) => {
        if (!cancelled) setYtError(`YouTube error (${code})`)
      },
      onStateChange: (st, player) => {
        if (!isHost || suppressLocalBroadcast.current) return
        const YT = window.YT?.PlayerState
        if (!YT || st !== YT.BUFFERING) return
        if (playbackStateRef.current.status === 'buffering') return
        const now = Date.now()
        if (now - ytBufferingRpcAtRef.current < 2500) return
        ytBufferingRpcAtRef.current = now
        void applyHostActionRef.current({
          type: 'buffering',
          positionSec: player.getCurrentTime(),
        })
      },
    })
      .then((player) => {
        if (cancelled || gen !== ytCreateGenRef.current) {
          player.destroy()
          return
        }
        ytPlayerRef.current = player
        ytPlayerVideoIdRef.current = youtubeVideoId
        setYtPlayerReady(true)
        setYtError(null)
      })
      .catch(() => {
        if (!cancelled && gen === ytCreateGenRef.current) {
          setYtError('Could not embed trailer. Try another title.')
        }
      })

    return () => {
      cancelled = true
      if (gen === ytCreateGenRef.current) {
        ytPlayerRef.current?.destroy()
        ytPlayerRef.current = null
        ytPlayerVideoIdRef.current = null
        setYtPlayerReady(false)
      }
    }
  }, [youtubeSource, youtubeVideoId, isHost, ytDomReady])

  useEffect(() => {
    const player = ytPlayerRef.current
    const s = playback.state
    if (!player || !ytPlayerReady || s.sourceType !== 'youtube_trailer') return
    if (
      isStaleAction(s.revision, s.actionId, lastActionRef.current.revision, lastActionRef.current.actionId)
    ) {
      return
    }
    lastActionRef.current = { revision: s.revision, actionId: s.actionId }
    suppressLocalBroadcast.current = true
    const expected = expectedPositionSec(s, Date.now(), playback.clockOffsetMs)
    if (s.status === 'playing') {
      player.playVideo()
      player.seekTo(expected, true)
    } else if (s.status === 'paused') {
      player.pauseVideo()
      player.seekTo(expected, true)
    } else if (s.status === 'buffering') {
      player.pauseVideo()
    }
    player.setPlaybackRate(s.playbackRate)
    window.setTimeout(() => {
      suppressLocalBroadcast.current = false
    }, 100)
  }, [
    playback.state.revision,
    playback.state.actionId,
    playback.state.status,
    playback.state.playbackRate,
    playback.state.sourceType,
    playback.clockOffsetMs,
    ytPlayerReady,
    suppressLocalBroadcast,
  ])

  useEffect(() => {
    if (!youtubeSource) return
    const id = window.setInterval(() => {
      const player = ytPlayerRef.current
      const s = playbackStateRef.current
      if (!player || !ytPlayerReady || s.sourceType !== 'youtube_trailer' || s.status === 'buffering') {
        return
      }
      const expected = expectedPositionSec(s, Date.now(), clockOffsetRef.current)
      const actual = player.getCurrentTime()
      const plan = planDriftCorrection(expected, actual, s.status, true)
      reportDriftRef.current(plan.driftMs, plan.kind === 'none' ? 'synced' : 'correcting')
      if (plan.kind === 'seek' && Math.abs(plan.driftMs) > DRIFT_HARD_MS && !isHost) {
        suppressLocalBroadcast.current = true
        player.seekTo(plan.positionSec, true)
        window.setTimeout(() => {
          suppressLocalBroadcast.current = false
        }, 50)
      } else if (plan.kind === 'rate' && !isHost) {
        player.setPlaybackRate(plan.rate)
      }
    }, 750)
    return () => window.clearInterval(id)
  }, [youtubeSource, ytPlayerReady, isHost])

  const onApplyHostVideo = useCallback(
    (status: typeof playback.state.status, positionSec: number, rate: number) => {
      if (status === 'playing') {
        media.applyHostPlaybackToVideo('seek', positionSec)
        media.applyHostPlaybackToVideo('play')
      } else if (status === 'buffering') {
        media.applyHostPlaybackToVideo('pause')
      } else {
        media.applyHostPlaybackToVideo('pause')
        media.applyHostPlaybackToVideo('seek', positionSec)
      }
      const v = document.querySelector<HTMLVideoElement>('video[data-host-local-video]')
      if (v) v.playbackRate = rate
    },
    [media],
  )

  const onApplyViewerVideo = useCallback(
    (status: typeof playback.state.status, positionSec: number, rate: number) => {
      if (status === 'playing') {
        media.applyViewerPlaybackToVideo('seek', positionSec, rate)
        media.applyViewerPlaybackToVideo('play', positionSec, rate)
      } else if (status === 'buffering') {
        media.applyViewerPlaybackToVideo('pause', positionSec, rate)
      } else {
        media.applyViewerPlaybackToVideo('pause', positionSec, rate)
        media.applyViewerPlaybackToVideo('seek', positionSec, rate)
      }
    },
    [media],
  )

  useVideoPlaybackSync({
    enabled: isHost && playback.state.sourceType === 'host_media' && media.hostFileLoadState === 'ready',
    isHost: true,
    clockOffsetMs: playback.clockOffsetMs,
    state: playback.state,
    getVideo: () => document.querySelector<HTMLVideoElement>('video[data-host-local-video]'),
    applyingRemote: suppressLocalBroadcast,
    onDrift: reportDrift,
    onApplyPlayPauseSeek: onApplyHostVideo,
  })

  useVideoPlaybackSync({
    enabled:
      !isHost &&
      playback.state.sourceType === 'host_media' &&
      media.viewerFileLoadState === 'ready' &&
      viewerSyncEnabled,
    isHost: false,
    clockOffsetMs: playback.clockOffsetMs,
    state: playback.state,
    getVideo: () => document.querySelector<HTMLVideoElement>('video[data-viewer-local-video]'),
    applyingRemote: suppressLocalBroadcast,
    onDrift: reportDrift,
    onApplyPlayPauseSeek: onApplyViewerVideo,
  })

  const hostControl = useCallback(
    async (type: 'play' | 'pause' | 'seek' | 'skip_forward' | 'skip_back', extra?: { positionSec?: number }) => {
      if (!isHost) return
      const player = ytPlayerRef.current
      let pos = extra?.positionSec
      if (pos == null) {
        if (playback.state.sourceType === 'youtube_trailer' && player) pos = player.getCurrentTime()
        else if (playback.state.sourceType === 'host_media' && media.hostFileLoadState === 'ready') {
          pos = media.getHostVideoCurrentTime() ?? playback.state.positionSec
        } else pos = playback.state.positionSec
      }
      if (type === 'skip_forward') pos = (pos ?? 0) + 10
      if (type === 'skip_back') pos = Math.max(0, (pos ?? 0) - 10)
      const res = await applyHostAction({ type, positionSec: pos })
      if (!res.ok) return
      const src = res.state.sourceType
      if (src === 'host_media') {
        if (type === 'play') media.applyHostPlaybackToVideo('play')
        if (type === 'pause') media.applyHostPlaybackToVideo('pause')
        if ((type === 'seek' || type === 'skip_forward' || type === 'skip_back') && pos != null) {
          media.applyHostPlaybackToVideo('seek', pos)
        }
      }
      if (src === 'youtube_trailer' && player) {
        if (type === 'play') player.playVideo()
        if (type === 'pause') player.pauseVideo()
        if (pos != null) player.seekTo(pos, true)
      }
    },
    [isHost, applyHostAction, media, playback.state.sourceType, playback.state.positionSec],
  )

  const togglePlay = useCallback(() => {
    void hostControl(playback.state.status === 'playing' ? 'pause' : 'play')
  }, [hostControl, playback.state.status])

  const togglePlayRef = useRef(togglePlay)
  togglePlayRef.current = togglePlay

  const bridgeTogglePlay = useCallback(() => {
    togglePlayRef.current()
  }, [])

  useEffect(() => {
    if (!onPlaybackBridge) return
    onPlaybackBridge({
      title: playback.state.movieTitle ?? 'Watch party',
      status: formatPlaybackStatusLabel(playback.state.status, playback.state.sourceType),
      syncLabel: membershipReady
        ? formatPlaybackSyncLabel(
            playback.diag.syncStatus,
            playback.state.sourceType,
            realtimeConnected,
          )
        : 'Joining room…',
      isHost,
      canControl: membershipReady && isHost && playback.state.sourceType !== 'none',
      togglePlay: bridgeTogglePlay,
    })
  }, [
    membershipReady,
    realtimeConnected,
    onPlaybackBridge,
    playback.state.movieTitle,
    playback.state.status,
    playback.diag.syncStatus,
    isHost,
    playback.state.sourceType,
    bridgeTogglePlay,
  ])

  const duration =
    playback.state.sourceType === 'host_media'
      ? isHost
        ? (media.hostDurationSec ?? playback.state.durationSec ?? 0)
        : (media.viewerDurationSec ?? playback.state.durationSec ?? 0)
      : (playback.state.durationSec ?? (ytPlayerRef.current?.getDuration() || 0))

  const displayPos =
    playback.state.sourceType === 'youtube_trailer' && ytPlayerRef.current
      ? ytPlayerRef.current.getCurrentTime()
      : playback.state.sourceType === 'host_media' && isHost && media.hostFileLoadState === 'ready'
        ? (media.getHostVideoCurrentTime() ?? playback.state.positionSec)
        : playback.state.sourceType === 'host_media' &&
            !isHost &&
            media.viewerFileLoadState === 'ready'
          ? (media.getViewerVideoCurrentTime() ?? playback.state.positionSec)
          : expectedPositionSec(playback.state, Date.now(), playback.clockOffsetMs)

  const timelineReady =
    (playback.state.sourceType === 'youtube_trailer' && ytPlayerReady) ||
    (playback.state.sourceType === 'host_media' &&
      (isHost ? media.hostFileLoadState === 'ready' : media.viewerFileLoadState === 'ready'))

  const fileLoading =
    media.hostFileLoadState === 'loading' || (hostMediaPreparing && playback.state.sourceType !== 'host_media')

  const [, tick] = useState(0)
  useEffect(() => {
    if (!timelineReady) return
    const id = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [timelineReady])

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {isHost && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
          <span className="text-xs text-[var(--color-muted)]">Source</span>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs ${sourceMode === 'trailer' ? 'bg-[#FE4401] text-white' : 'border border-[var(--color-border)]'}`}
            onClick={() => setSourceMode('trailer')}
          >
            Trailer (OMDb)
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs ${sourceMode === 'file' ? 'bg-[#FE4401] text-white' : 'border border-[var(--color-border)]'}`}
            onClick={() => setSourceMode('file')}
          >
            Your file
          </button>
          {sourceMode === 'file' && (
            <label className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:border-[#FE4401]">
              Choose video
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onHostFile(f)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          {media.hostFileName && (
            <span className="max-w-[10rem] truncate text-[10px] text-[var(--color-muted)]">{media.hostFileName}</span>
          )}
          {sourceMode === 'trailer' && (
            <>
              <input
                type="search"
                value={trailerQuery}
                onChange={(e) => setTrailerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void searchAndLoadTrailer()
                }}
                placeholder="Search title or tt1234567"
                className="min-w-[10rem] max-w-[14rem] flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs"
              />
              <button
                type="button"
                className="rounded-md bg-[#FE4401] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                disabled={selectingTrailer}
                onClick={() => void searchAndLoadTrailer()}
              >
                Load trailer
              </button>
            </>
          )}
          {sourceMode === 'trailer' && proposalMovies.length > 0 && (
            <select
              className="max-w-[12rem] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs"
              defaultValue=""
              onChange={(e) => {
                const m = proposalMovies.find((x) => x.imdbId === e.target.value)
                if (m) void loadTrailer(m)
              }}
            >
              <option value="" disabled>Pick from shortlist…</option>
              {proposalMovies.filter((m) => m.imdbId).map((m) => (
                <option key={m.imdbId} value={m.imdbId}>{m.title}</option>
              ))}
            </select>
          )}
          {selectingTrailer && <span className="text-xs text-[var(--color-muted)]">Loading trailer…</span>}
        </div>
      )}

      {playback.state.sourceType === 'none' && !fileLoading ? (
        <div className="mx-3 my-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-6 py-8 text-center">
          <p className="text-sm font-medium text-[var(--color-fg)]">Nothing playing yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted)]">
            {isHost
              ? 'Search OMDb for a trailer or choose a local video file. Playback stays in this room only — browsing Discover will not change what everyone watches.'
              : 'Waiting for the host to pick a trailer or shared video file.'}
          </p>
          {isHost && sourceMode === 'file' && (
            <label className="cursor-pointer rounded-lg bg-[#FE4401] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Choose video file
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onHostFile(f)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          {isHost && sourceMode === 'trailer' && (
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:border-[#FE4401]"
              onClick={() => void searchAndLoadTrailer()}
            >
              Load trailer from search
            </button>
          )}
        </div>
      ) : (
      <VideoPlayerChrome
        durationSec={duration}
        positionSec={displayPos}
        disabled={!timelineReady || playback.state.sourceType === 'none'}
        readOnly={!isHost}
        isPlaying={playback.state.status === 'playing'}
        isHost={isHost}
        onCommitSeek={(sec) => void hostControl('seek', { positionSec: sec })}
        onSkipBack={() => void hostControl('skip_back')}
        onSkipForward={() => void hostControl('skip_forward')}
        onTogglePlay={togglePlay}
      >
        {playback.state.sourceType === 'youtube_trailer' && (
          <>
            <div ref={bindYtContainer} className="absolute inset-0 h-full w-full" />
            {!ytPlayerReady && !ytError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-sm text-white/80">
                Loading trailer…
              </div>
            )}
          </>
        )}
        {showHostVideo && (
          <video
            ref={media.setHostVideoElement}
            data-host-local-video
            className={`absolute inset-0 h-full w-full object-contain ${
              playback.state.sourceType === 'host_media' ? '' : 'pointer-events-none opacity-0'
            }`}
            playsInline
            muted
            preload="auto"
          />
        )}
        {fileLoading && isHost && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-sm text-white/80">
            Loading video…
          </div>
        )}
        {showViewerVideo && (
          <video
            ref={media.viewerVideoRef}
            data-viewer-local-video
            className="h-full w-full object-contain"
            playsInline
            preload="auto"
          />
        )}
        {showViewerVideo && media.viewerFileLoadState === 'transferring' && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-white/80">
            Receiving file… {Math.round(media.transferProgress * 100)}%
            {media.transferBytesTotal > 0
              ? ` (${Math.round(media.transferBytesReceived / 1024 / 1024)} / ${Math.round(media.transferBytesTotal / 1024 / 1024)} MB)`
              : ''}
          </div>
        )}
        {showViewerVideo && media.viewerFileLoadState === 'verifying' && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-white/80">
            Verifying file…
          </div>
        )}
        {showViewerVideo &&
          (media.status === 'connecting' || media.status === 'waiting_host') &&
          media.viewerFileLoadState === 'idle' && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-white/80">
            {media.status === 'waiting_host'
              ? 'Waiting for host…'
              : 'Connecting to host for file transfer…'}
            <button
              type="button"
              className="ml-2 underline text-[#FE4401]"
              onClick={() => media.requestFileFromHost()}
            >
              Retry
            </button>
          </div>
        )}
        {showViewerVideo && media.status === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-red-200">
            {media.error ?? 'Could not receive host file. TURN may be required.'}
          </div>
        )}
        {(ytError || media.error || playback.diag.lastError) && (
          <div className="absolute inset-x-0 top-0 z-20 bg-red-950/80 p-2 text-center text-xs text-red-100">
            {ytError ?? media.error ?? playback.diag.lastError}
          </div>
        )}
      </VideoPlayerChrome>
      )}

      <div className="space-y-1 border-t border-[var(--color-border)] px-3 py-2 text-[10px] text-[var(--color-muted)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {isHost ? 'You control playback' : `Host: ${hostMemberKey?.slice(0, 8) ?? '—'}…`}
            {playback.state.movieTitle ? ` · ${playback.state.movieTitle}` : ''}
          </span>
          <span>
            Sync: {playback.diag.syncStatus}
            {playback.diag.driftMs != null ? ` · drift ${Math.round(playback.diag.driftMs)}ms` : ''}
          </span>
        </div>
        {playback.state.status === 'buffering' && <span className="text-amber-300">Buffering…</span>}
        {!isHost && playback.state.sourceType === 'host_media' && media.viewerFileLoadState !== 'ready' && (
          <p>Waiting for the full video file before timeline sync is enabled.</p>
        )}
      </div>
    </section>
  )
}
