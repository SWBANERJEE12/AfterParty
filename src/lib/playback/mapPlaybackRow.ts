import type { PlaybackSourceType, PlaybackStatus, RoomPlaybackState } from '../../shared/playback'
import { EMPTY_PLAYBACK_STATE } from '../../shared/playback'

export type PlaybackDbRow = {
  room_id: string
  source_type: string
  imdb_id: string | null
  movie_title: string | null
  youtube_video_id: string | null
  media_session_id: string | null
  host_member_key: string | null
  status: string
  position_sec: number
  playback_rate: number
  duration_sec: number | null
  revision: number
  action_id: string | null
  action_type: string | null
  authoritative_ts: number
}

export function mapPlaybackRow(row: PlaybackDbRow | undefined, roomId: string): RoomPlaybackState {
  if (!row) return EMPTY_PLAYBACK_STATE(roomId)
  return {
    roomId: row.room_id,
    sourceType: row.source_type as PlaybackSourceType,
    imdbId: row.imdb_id,
    movieTitle: row.movie_title,
    youtubeVideoId: row.youtube_video_id,
    mediaSessionId: row.media_session_id,
    hostMemberKey: row.host_member_key,
    status: row.status as PlaybackStatus,
    positionSec: row.position_sec,
    playbackRate: row.playback_rate,
    durationSec: row.duration_sec,
    revision: Number(row.revision),
    actionId: row.action_id,
    actionType: (row.action_type as RoomPlaybackState['actionType']) ?? null,
    authoritativeTs: Number(row.authoritative_ts),
  }
}
