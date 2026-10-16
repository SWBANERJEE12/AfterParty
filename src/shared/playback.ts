export type PlaybackSourceType = 'none' | 'youtube_trailer' | 'host_media'

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'buffering'

export type PlaybackActionType =
  | 'select_source'
  | 'play'
  | 'pause'
  | 'seek'
  | 'skip_forward'
  | 'skip_back'
  | 'rate'
  | 'buffering'
  | 'ready'

export type RoomPlaybackState = {
  roomId: string
  sourceType: PlaybackSourceType
  imdbId: string | null
  movieTitle: string | null
  youtubeVideoId: string | null
  mediaSessionId: string | null
  hostMemberKey: string | null
  status: PlaybackStatus
  positionSec: number
  playbackRate: number
  revision: number
  actionId: string | null
  actionType: PlaybackActionType | null
  authoritativeTs: number
  durationSec: number | null
}

export const EMPTY_PLAYBACK_STATE = (roomId: string): RoomPlaybackState => ({
  roomId,
  sourceType: 'none',
  imdbId: null,
  movieTitle: null,
  youtubeVideoId: null,
  mediaSessionId: null,
  hostMemberKey: null,
  status: 'idle',
  positionSec: 0,
  playbackRate: 1,
  revision: 0,
  actionId: null,
  actionType: null,
  authoritativeTs: Date.now(),
  durationSec: null,
})

export const PLAYBACK_BROADCAST_EVENT = 'playback_sync'
export const MEDIA_SIGNAL_EVENT = 'media_signal'

/** Target sync viewers (WebRTC); room membership cap may differ (see rooms.max_members). */
export function playbackSyncTarget(): number {
  try {
    const raw = import.meta.env?.VITE_PLAYBACK_SYNC_TARGET
    if (raw) return Number(raw) || 10
  } catch {
    /* node / test */
  }
  return 10
}

export const DRIFT_SOFT_MS = 120
export const DRIFT_HARD_MS = 500
