import type { MovieMeta, VoteState } from './movies'

export const MAX_ROOM_PLAYERS = 10

export type WorldLocation = 'home' | 'blockbuster' | 'cafe'

export type PlayerSnapshot = {
  id: string
  name: string
  color: string
  x: number
  z: number
  yaw: number
  moving: boolean
  location: WorldLocation
}

export type JoinedRoomPayload = {
  roomCode: string
  selfId: string
  players: PlayerSnapshot[]
  vote: VoteState
}

export type RoomErrorCode =
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_CODE'
  | 'NAME_REQUIRED'
  | 'SHORTLIST_FULL'

export type ClientToServerEvents = {
  createRoom: (name: string, ack: (res: JoinedRoomPayload | { error: RoomErrorCode }) => void) => void
  joinRoom: (
    payload: { code: string; name: string },
    ack: (res: JoinedRoomPayload | { error: RoomErrorCode }) => void,
  ) => void
  playerState: (state: {
    x: number
    z: number
    yaw: number
    moving: boolean
    location: WorldLocation
  }) => void
  travel: (payload: { to: WorldLocation; from: WorldLocation }) => void
  shortlistAdd: (movie: MovieMeta, ack: (res: { ok: true } | { error: RoomErrorCode }) => void) => void
  shortlistRemove: (movieId: number) => void
  castVote: (movieId: number) => void
}

export type PlayerMotionPayload = {
  id: string
  x: number
  z: number
  yaw: number
  moving: boolean
  location: WorldLocation
}

export type ServerToClientEvents = {
  roomPlayers: (players: PlayerSnapshot[]) => void
  playerJoined: (player: PlayerSnapshot) => void
  playerLeft: (playerId: string) => void
  playerMotion: (payload: PlayerMotionPayload) => void
  voteState: (state: VoteState) => void
}
