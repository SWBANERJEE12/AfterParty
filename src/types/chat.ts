export type RoomMessage = {
  id: string
  room_id: string
  member_key: string
  nickname: string
  body: string
  created_at: string
}

export const CHAT_MAX_LENGTH = 2000
