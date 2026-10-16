export type VoiceSignal =
  | { type: 'hello'; from: string; nickname: string }
  | { type: 'leave'; from: string }
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'mute'; from: string; muted: boolean }
  | { type: 'speaking'; from: string; speaking: boolean }

export const VOICE_BROADCAST_EVENT = 'voice_signal'

export function shouldInitiateOffer(localMemberKey: string, remoteMemberKey: string): boolean {
  return localMemberKey.localeCompare(remoteMemberKey) < 0
}
