import { createContext, useContext, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useRoomVoice } from '../hooks/useRoomVoice'
import type { Participant } from '../hooks/useWatchRoom'

type VoiceContextValue = ReturnType<typeof useRoomVoice>

const RoomVoiceContext = createContext<VoiceContextValue | null>(null)

type ProviderProps = {
  channel: RealtimeChannel | null
  memberKey: string
  nickname: string
  roomReady: boolean
  roomParticipants: Participant[]
  children: ReactNode
}

export function RoomVoiceProvider({
  channel,
  memberKey,
  nickname,
  roomReady,
  roomParticipants,
  children,
}: ProviderProps) {
  const value = useRoomVoice(channel, memberKey, nickname, roomReady, roomParticipants)
  return <RoomVoiceContext.Provider value={value}>{children}</RoomVoiceContext.Provider>
}

export function useRoomVoiceContext() {
  const ctx = useContext(RoomVoiceContext)
  if (!ctx) throw new Error('useRoomVoiceContext requires RoomVoiceProvider')
  return ctx
}
