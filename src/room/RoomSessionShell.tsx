import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type RefCallback } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { FloatingRoomChat } from '../components/room/FloatingRoomChat'
import { FloatingVoiceBar } from '../components/room/FloatingVoiceBar'
import { RoomVoiceProvider } from './RoomVoiceContext'
import { ProposalVoteModal } from '../components/room/ProposalVoteModal'
import { SyncWatchPlayer } from '../components/room/SyncWatchPlayer'
import { WatchPartyMiniPlayer } from '../components/room/WatchPartyMiniPlayer'
import { useRoomParty } from '../hooks/useRoomParty'
import { useRoomProposals } from '../hooks/useRoomProposals'
import { useRoomVotePolls } from '../hooks/useRoomVotePolls'
import { leaveRoomMember, useWatchRoom } from '../hooks/useWatchRoom'
import { fetchMovieTrailer } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import { useStoredNickname } from '../hooks/useStoredNickname'
import { getOrCreateMemberKey } from '../lib/session'
import { RoomSessionDataProvider } from './RoomSessionDataContext'
import {
  isRoomRoute,
  shouldAutoMinimizeRoom,
  shouldRunBackgroundRoomPlayer,
  shouldShowFullRoomPlayer,
} from './roomNavigation'
import { formatPlaybackStatusLabel, formatPlaybackSyncLabel } from '../lib/playback/formatSyncLabel'
import { useRoomSession } from './RoomSessionContext'

type PlaybackBridge = {
  title: string | null
  status: string
  syncLabel: string
  isHost: boolean
  togglePlay: () => void
  canControl: boolean
}

export const PLAYER_MOUNT_ID = 'watch-player-mount'

export function RoomSessionShell() {
  const { activeRoomId, viewMode, leaveRequested, acknowledgeLeave, expandRoom, leaveRoom, minimizeRoom } =
    useRoomSession()
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const routeRoomMatch = useMatch('/room/:roomId')
  const routeRoomId = routeRoomMatch?.params.roomId ?? null
  const roomId = activeRoomId ?? routeRoomId ?? ''
  const { stored: nicknameStored, displayName: nicknameDisplay } = useStoredNickname()
  const nickname = nicknameStored ?? nicknameDisplay
  const joinNickname = nicknameStored ?? ''
  const memberKey = useMemo(() => getOrCreateMemberKey(), [])
  const [playbackBridge, setPlaybackBridge] = useState<PlaybackBridge | null>(null)

  useLayoutEffect(() => {
    const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const routerPath = `${location.pathname}${location.search}${location.hash}`
    if (browserPath !== routerPath) {
      navigate(browserPath, { replace: true })
    }
  })

  useEffect(() => {
    if (shouldAutoMinimizeRoom(activeRoomId, pathname, viewMode)) {
      minimizeRoom()
    }
  }, [activeRoomId, pathname, viewMode, minimizeRoom])

  useEffect(() => {
    if (activeRoomId && isRoomRoute(pathname)) {
      expandRoom()
    }
  }, [activeRoomId, pathname, expandRoom])

  const watch = useWatchRoom(roomId, joinNickname, { leaveOnUnmount: false })
  const { party, isHost, transferError, transferHost, broadcastPartyRefresh } = useRoomParty(
    roomId,
    memberKey,
    watch.membershipReady && isSupabaseConfigured,
    watch.connected,
    watch.presenceChannel,
  )
  const { proposals } = useRoomProposals(
    roomId,
    memberKey,
    watch.membershipReady && isSupabaseConfigured,
  )
  const votePolls = useRoomVotePolls(
    roomId,
    memberKey,
    watch.membershipReady && isSupabaseConfigured,
    watch.presenceChannel,
  )

  const proposalMovies = useMemo(
    () =>
      proposals.map((p) => ({
        id: 0,
        imdbId: p.imdb_id,
        title: p.title,
        overview: '',
        posterUrl: p.poster_url,
        releaseYear: p.release_year ?? '—',
        trailerYoutubeKey: null,
      })),
    [proposals],
  )

  const sessionData = useMemo(() => {
    if (!roomId) return null
    return {
      roomId,
      nickname,
      memberKey,
      participants: watch.participants,
      connected: watch.connected,
      realtimeStatus: watch.realtimeStatus,
      realtimeError: watch.realtimeError,
      error: watch.error,
      membershipReady: watch.membershipReady,
      presenceChannel: watch.presenceChannel,
      isSupabaseConfigured,
      party,
      isHost,
      proposalMovies,
      proposals,
      transferError,
      transferHost,
      broadcastPartyRefresh,
    }
  }, [
    roomId,
    nickname,
    memberKey,
    watch,
    party,
    isHost,
    proposalMovies,
    proposals,
    transferError,
    transferHost,
    broadcastPartyRefresh,
  ])

  useEffect(() => {
    if (!leaveRequested || !roomId) return
    void (async () => {
      await leaveRoomMember(roomId, memberKey)
      acknowledgeLeave()
      setPlaybackBridge(null)
      navigate('/party')
    })()
  }, [leaveRequested, roomId, memberKey, acknowledgeLeave, navigate])

  const onPlaybackBridge = useCallback((bridge: PlaybackBridge) => {
    setPlaybackBridge(bridge)
  }, [])

  const [voteModalDismissed, setVoteModalDismissed] = useState<string | null>(null)
  const pollId = votePolls.details?.poll?.id
  const showVoteModal =
    votePolls.details?.poll?.status === 'open' && pollId != null && pollId !== voteModalDismissed

  const handlePlayProposedTrailer = useCallback(async () => {
    const poll = votePolls.details?.poll
    if (!poll || !isHost) return
    const trailer = poll.youtube_video_id
      ? { videoId: poll.youtube_video_id }
      : await fetchMovieTrailer(poll.imdb_id)
    if (!trailer.videoId) return
    await watch.presenceChannel?.send({
      type: 'broadcast',
      event: 'play_proposed_trailer',
      payload: {
        imdbId: poll.imdb_id,
        title: poll.title,
        youtubeVideoId: trailer.videoId,
      },
    })
  }, [votePolls.details, isHost, watch.presenceChannel])

  const showFullPlayer = shouldShowFullRoomPlayer(roomId || null, pathname)
  const showBackgroundPlayer = shouldRunBackgroundRoomPlayer(activeRoomId, pathname, viewMode)
  const [offscreenMount, setOffscreenMount] = useState<HTMLDivElement | null>(null)
  const onOffscreenMount: RefCallback<HTMLDivElement> = useCallback((node) => {
    setOffscreenMount(node)
  }, [])
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!showFullPlayer) {
      setMountEl(null)
      return
    }
    const resolveMount = () => document.getElementById(PLAYER_MOUNT_ID)
    const el = resolveMount()
    if (el) {
      setMountEl(el)
      return
    }
    const frame = requestAnimationFrame(() => {
      setMountEl(resolveMount())
    })
    return () => cancelAnimationFrame(frame)
  }, [showFullPlayer, pathname, roomId])

  if (!roomId || !sessionData) {
    return <Outlet key={pathname} />
  }

  const player = (
    <SyncWatchPlayer
      roomId={roomId}
      memberKey={memberKey}
      isHost={isHost}
      hostMemberKey={party?.hostMemberKey ?? null}
      membershipReady={watch.membershipReady && isSupabaseConfigured}
      realtimeConnected={watch.connected}
      channel={watch.presenceChannel}
      proposalMovies={proposalMovies}
      onPlaybackBridge={onPlaybackBridge}
    />
  )

  const sessionReady = isSupabaseConfigured && watch.membershipReady
  const connectionLabel = watch.connected
    ? 'Presence live'
    : watch.realtimeStatus === 'error'
      ? 'Realtime error'
      : watch.realtimeStatus === 'reconnecting'
        ? 'Reconnecting…'
        : 'Connecting…'
  const miniBridge: PlaybackBridge =
    playbackBridge ?? {
      title: 'Watch party',
      status: watch.membershipReady
        ? formatPlaybackStatusLabel('paused', 'none')
        : 'Joining…',
      syncLabel: watch.membershipReady
        ? formatPlaybackSyncLabel('unknown', 'none', watch.connected)
        : connectionLabel,
      isHost,
      canControl: false,
      togglePlay: () => {},
    }
  const showMini = showBackgroundPlayer

  return (
    <RoomSessionDataProvider value={sessionData}>
      <RoomVoiceProvider
        channel={watch.presenceChannel}
        memberKey={memberKey}
        nickname={nickname}
        roomReady={sessionReady}
        roomParticipants={watch.participants}
      >
      <Outlet key={pathname} />

      <div
        ref={onOffscreenMount}
        className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0 [&_*]:!pointer-events-none"
        aria-hidden
      />
      {(() => {
        const portalTarget = showFullPlayer && mountEl ? mountEl : offscreenMount
        return portalTarget ? createPortal(player, portalTarget) : null
      })()}

      {showMini && (
        <WatchPartyMiniPlayer
          roomId={roomId}
          connected={watch.connected}
          membershipReady={watch.membershipReady}
          title={miniBridge.title}
          syncLabel={miniBridge.syncLabel}
          status={miniBridge.status}
          isHost={miniBridge.isHost}
          canControl={miniBridge.canControl}
          onTogglePlay={miniBridge.togglePlay}
          onExpand={() => {
            expandRoom()
            navigate(`/room/${roomId}`)
          }}
          onLeave={leaveRoom}
        />
      )}

      <FloatingVoiceBar />

      {sessionReady && (
        <FloatingRoomChat
          roomId={roomId}
          nickname={nickname}
          memberKey={memberKey}
          channel={watch.presenceChannel}
          membershipReady={watch.membershipReady}
          realtimeConnected={watch.connected}
          realtimeStatus={watch.realtimeStatus}
        />
      )}

      <ProposalVoteModal
        open={Boolean(showVoteModal)}
        memberKey={memberKey}
        details={votePolls.details}
        isHost={isHost}
        onVote={(v) => {
          if (votePolls.activePollId) void votePolls.castVote(votePolls.activePollId, v)
        }}
        onClose={() => setVoteModalDismissed(votePolls.details?.poll.id ?? null)}
        onPlayTrailer={() => void handlePlayProposedTrailer()}
      />
      </RoomVoiceProvider>
    </RoomSessionDataProvider>
  )
}
