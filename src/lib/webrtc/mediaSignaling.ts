export type MediaSignal =
  | { type: 'hello'; from: string; sessionId: string; role: 'host' | 'viewer' }
  | { type: 'request_file'; from: string; to: string; sessionId: string }
  | { type: 'leave'; from: string }
  | { type: 'offer'; from: string; to: string; sessionId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sessionId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; sessionId: string; candidate: RTCIceCandidateInit }
  | { type: 'session_end'; from: string; sessionId: string }

export const MEDIA_SIGNAL_EVENT = 'media_signal'

export function mediaSignalId(signal: MediaSignal): string {
  if (signal.type === 'offer' || signal.type === 'answer') {
    return `${signal.type}:${signal.from}:${signal.to}:${signal.sessionId}:${signal.sdp.sdp?.slice(0, 32) ?? ''}`
  }
  if (signal.type === 'ice') {
    return `ice:${signal.from}:${signal.to}:${signal.candidate.candidate ?? ''}`
  }
  if (signal.type === 'request_file') {
    return `request_file:${signal.from}:${signal.to}:${signal.sessionId}`
  }
  return `${signal.type}:${signal.from}:${(signal as { sessionId?: string }).sessionId ?? ''}`
}
