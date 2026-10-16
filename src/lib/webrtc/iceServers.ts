/** ICE servers for voice (STUN/TURN). Audio only — TURN often required on restrictive networks. */
export function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RTCIceServer[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      if (import.meta.env.DEV) {
        console.warn('[afterparty:voice] Invalid VITE_WEBRTC_ICE_SERVERS JSON; using default STUN.')
      }
    }
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }]
}
