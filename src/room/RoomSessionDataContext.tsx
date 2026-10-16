import { createContext, useContext, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Participant, RealtimeStatus } from '../hooks/useWatchRoom'
import type { RoomPartyState } from '../hooks/useRoomParty'
import type { RoomProposal } from '../hooks/useRoomProposals'

export type RoomSessionData = {
  roomId: string
  nickname: string
  memberKey: string
  participants: Participant[]
  connected: boolean
  realtimeStatus: RealtimeStatus
  realtimeError: string | null
  error: string | null
  membershipReady: boolean
  presenceChannel: RealtimeChannel | null
  isSupabaseConfigured: boolean
  party: RoomPartyState | null
  isHost: boolean
  proposalMovies: Array<{
    id: number
    imdbId: string | null
    title: string
    overview: string
    posterUrl: string | null
    releaseYear: string
    trailerYoutubeKey: null
  }>
  proposals: RoomProposal[]
  transferError: string | null
  transferHost: (newHostMemberKey: string) => Promise<{ ok: true } | { ok: false; error: string }>
  broadcastPartyRefresh: () => Promise<void>
}

const Ctx = createContext<RoomSessionData | null>(null)

export function RoomSessionDataProvider({ value, children }: { value: RoomSessionData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRoomSessionData() {
  return useContext(Ctx)
}
