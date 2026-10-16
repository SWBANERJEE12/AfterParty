import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getIceServers } from '../lib/webrtc/iceServers'
import {
  shouldInitiateOffer,
  VOICE_BROADCAST_EVENT,
  type VoiceSignal,
} from '../lib/webrtc/voiceSignaling'
import type { Participant } from './useWatchRoom'

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnecting'

export type VoiceMemberView = {
  memberKey: string
  nickname: string
  isSelf: boolean
  inVoice: boolean
  speaking: boolean
  micMuted: boolean
  voiceConnected: boolean
}

type PeerEntry = {
  pc: RTCPeerConnection
  audio: HTMLAudioElement
  gainNode?: GainNode
  source?: MediaStreamAudioSourceNode
}

function voiceLog(...args: unknown[]) {
  if (import.meta.env.DEV) console.debug('[afterparty:voice]', ...args)
}

export function useRoomVoice(
  channel: RealtimeChannel | null,
  memberKey: string,
  nickname: string,
  roomReady: boolean,
  roomParticipants: Participant[],
) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [inVoice, setInVoice] = useState(false)
  const [voiceMembers, setVoiceMembers] = useState<Map<string, { nickname: string; muted: boolean; speaking: boolean }>>(
    () => new Map(),
  )

  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerEntry>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const speakingRef = useRef(false)
  const localMutedRef = useRef<Map<string, boolean>>(new Map())
  const localVolumeRef = useRef<Map<string, number>>(new Map())
  const sessionRef = useRef(0)
  const inVoiceRef = useRef(false)
  const memberKeyRef = useRef(memberKey)
  memberKeyRef.current = memberKey

  const sendSignal = useCallback(
    async (signal: VoiceSignal) => {
      if (!channel) return
      await channel.send({
        type: 'broadcast',
        event: VOICE_BROADCAST_EVENT,
        payload: signal,
      })
    },
    [channel],
  )

  const teardownPeers = useCallback(() => {
    for (const [, entry] of peersRef.current) {
      entry.pc.close()
      entry.audio.pause()
      entry.audio.srcObject = null
      try {
        entry.source?.disconnect()
        entry.gainNode?.disconnect()
      } catch {
        /* ignore */
      }
    }
    peersRef.current.clear()
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop()
      localStreamRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  const leaveVoice = useCallback(async () => {
    const session = sessionRef.current
    setStatus('disconnecting')
    void sendSignal({ type: 'leave', from: memberKey })
    teardownPeers()
    inVoiceRef.current = false
    setInVoice(false)
    setMicMuted(false)
    setVoiceMembers(new Map())
    setError(null)
    setStatus('idle')
    voiceLog('left voice', { session })
  }, [memberKey, sendSignal, teardownPeers])

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const attachRemoteStream = useCallback(
    (remoteKey: string, stream: MediaStream) => {
      const ctx = ensureAudioContext()
      let entry = peersRef.current.get(remoteKey)
      if (!entry) return

      const source = ctx.createMediaStreamSource(stream)
      const gainNode = ctx.createGain()
      const vol = localVolumeRef.current.get(remoteKey) ?? 1
      const locallyMuted = localMutedRef.current.get(remoteKey) ?? false
      gainNode.gain.value = locallyMuted ? 0 : vol
      source.connect(gainNode)
      gainNode.connect(ctx.destination)

      entry.source = source
      entry.gainNode = gainNode
      entry.audio.srcObject = stream
      void entry.audio.play().catch(() => {
        /* autoplay may need user gesture */
      })
    },
    [ensureAudioContext],
  )

  const createPeerConnection = useCallback(
    (remoteKey: string) => {
      if (peersRef.current.has(remoteKey)) return peersRef.current.get(remoteKey)!.pc

      const pc = new RTCPeerConnection({ iceServers: getIceServers() })
      const audio = document.createElement('audio')
      audio.autoplay = true

      const entry: PeerEntry = { pc, audio }
      peersRef.current.set(remoteKey, entry)

      const stream = localStreamRef.current
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream)
        }
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          void sendSignal({
            type: 'ice',
            from: memberKey,
            to: remoteKey,
            candidate: ev.candidate.toJSON(),
          })
        }
      }

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams
        if (remoteStream) attachRemoteStream(remoteKey, remoteStream)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' && import.meta.env.DEV) {
          console.error('[afterparty:voice] peer connection failed', { remoteKey })
        }
      }

      return pc
    },
    [attachRemoteStream, memberKey, sendSignal],
  )

  const connectToPeer = useCallback(
    async (remoteKey: string) => {
      if (remoteKey === memberKey) return
      const pc = createPeerConnection(remoteKey)
      if (shouldInitiateOffer(memberKey, remoteKey)) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal({ type: 'offer', from: memberKey, to: remoteKey, sdp: offer })
      }
    },
    [createPeerConnection, memberKey, sendSignal],
  )

  const handleSignal = useCallback(
    async (signal: VoiceSignal) => {
      if (signal.from === memberKey) return

      switch (signal.type) {
        case 'hello':
          setVoiceMembers((prev) => {
            const next = new Map(prev)
            next.set(signal.from, {
              nickname: signal.nickname,
              muted: next.get(signal.from)?.muted ?? false,
              speaking: next.get(signal.from)?.speaking ?? false,
            })
            return next
          })
          if (inVoiceRef.current) await connectToPeer(signal.from)
          break
        case 'leave':
          setVoiceMembers((prev) => {
            const next = new Map(prev)
            next.delete(signal.from)
            return next
          })
          const peer = peersRef.current.get(signal.from)
          if (peer) {
            peer.pc.close()
            peersRef.current.delete(signal.from)
          }
          break
        case 'offer':
          if (signal.to !== memberKey || !inVoiceRef.current) return
          {
            const pc = createPeerConnection(signal.from)
            await pc.setRemoteDescription(signal.sdp)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await sendSignal({ type: 'answer', from: memberKey, to: signal.from, sdp: answer })
          }
          break
        case 'answer':
          if (signal.to !== memberKey) return
          {
            const pc = peersRef.current.get(signal.from)?.pc
            if (pc && !pc.currentRemoteDescription) {
              await pc.setRemoteDescription(signal.sdp)
            }
          }
          break
        case 'ice':
          if (signal.to !== memberKey) return
          {
            const pc = peersRef.current.get(signal.from)?.pc
            if (pc && signal.candidate) {
              try {
                await pc.addIceCandidate(signal.candidate)
              } catch (e) {
                if (import.meta.env.DEV) console.warn('[afterparty:voice] addIceCandidate', e)
              }
            }
          }
          break
        case 'mute':
          setVoiceMembers((prev) => {
            const next = new Map(prev)
            const cur = next.get(signal.from)
            next.set(signal.from, {
              nickname: cur?.nickname ?? 'Guest',
              muted: signal.muted,
              speaking: cur?.speaking ?? false,
            })
            return next
          })
          break
        case 'speaking':
          setVoiceMembers((prev) => {
            const next = new Map(prev)
            const cur = next.get(signal.from)
            if (!cur) return prev
            next.set(signal.from, { ...cur, speaking: signal.speaking })
            return next
          })
          break
        default:
          break
      }
    },
    [connectToPeer, createPeerConnection, memberKey, sendSignal],
  )

  const joinVoice = useCallback(async () => {
    if (!roomReady || !channel || inVoice) return
    sessionRef.current += 1
    setError(null)
    setStatus('connecting')
    voiceLog('join voice')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      const ctx = ensureAudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      analyserRef.current = analyser

      inVoiceRef.current = true
      setInVoice(true)
      setStatus('connected')
      setVoiceMembers((prev) => {
        const next = new Map(prev)
        next.set(memberKey, { nickname, muted: false, speaking: false })
        return next
      })
      await sendSignal({ type: 'hello', from: memberKey, nickname })

      for (const p of roomParticipants) {
        if (p.memberKey !== memberKey) {
          await connectToPeer(p.memberKey)
        }
      }
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : e instanceof Error
            ? e.message
            : 'Could not access microphone.'
      if (import.meta.env.DEV) console.error('[afterparty:voice] join failed', e)
      setError(msg)
      setStatus('error')
      teardownPeers()
      inVoiceRef.current = false
      setInVoice(false)
    }
  }, [
    channel,
    connectToPeer,
    ensureAudioContext,
    inVoice,
    memberKey,
    nickname,
    roomParticipants,
    roomReady,
    sendSignal,
    teardownPeers,
  ])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    const track = stream?.getAudioTracks()[0]
    if (!track) return
    const next = !track.enabled
    track.enabled = next
    setMicMuted(!next)
    void sendSignal({ type: 'mute', from: memberKey, muted: !next })
  }, [memberKey, sendSignal])

  const setLocalVolume = useCallback((remoteKey: string, volume: number) => {
    const v = Math.max(0, Math.min(1, volume))
    localVolumeRef.current.set(remoteKey, v)
    const peer = peersRef.current.get(remoteKey)
    if (peer?.gainNode && !localMutedRef.current.get(remoteKey)) {
      peer.gainNode.gain.value = v
    }
  }, [])

  const setLocalMuted = useCallback((remoteKey: string, muted: boolean) => {
    localMutedRef.current.set(remoteKey, muted)
    const peer = peersRef.current.get(remoteKey)
    if (peer?.gainNode) {
      peer.gainNode.gain.value = muted ? 0 : (localVolumeRef.current.get(remoteKey) ?? 1)
    }
  }, [])

  useEffect(() => {
    if (!channel || !roomReady) return
    let active = true

    const handler = (payload: { payload: VoiceSignal }) => {
      if (!active) return
      void handleSignal(payload.payload)
    }
    channel.on('broadcast', { event: VOICE_BROADCAST_EVENT }, handler)

    return () => {
      active = false
    }
  }, [channel, handleSignal, roomReady])

  useEffect(() => {
    if (!inVoice || !analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    let raf = 0
    let lastBroadcast = 0

    const tick = () => {
      const analyser = analyserRef.current
      if (!analyser) return
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (const v of data) sum += v
      const avg = sum / data.length
      const speaking = avg > 18 && !micMuted
      if (speaking !== speakingRef.current) {
        speakingRef.current = speaking
        const now = Date.now()
        if (now - lastBroadcast > 200) {
          lastBroadcast = now
          void sendSignal({ type: 'speaking', from: memberKey, speaking })
        }
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [inVoice, micMuted, memberKey, sendSignal])

  useEffect(() => {
    return () => {
      if (inVoiceRef.current) {
        void sendSignal({ type: 'leave', from: memberKeyRef.current })
      }
      teardownPeers()
    }
  }, [sendSignal, teardownPeers])

  useEffect(() => {
    if (!roomReady && inVoiceRef.current) void leaveVoice()
  }, [roomReady, leaveVoice])

  const memberViews: VoiceMemberView[] = roomParticipants.slice(0, 10).map((p) => {
    const voice = voiceMembers.get(p.memberKey)
    const isSelf = p.memberKey === memberKey
    return {
      memberKey: p.memberKey,
      nickname: p.nickname,
      isSelf,
      inVoice: Boolean(voice) || (isSelf && inVoice),
      speaking: voice?.speaking ?? false,
      micMuted: isSelf ? micMuted : (voice?.muted ?? false),
      voiceConnected: isSelf ? inVoice && status === 'connected' : Boolean(voice),
    }
  })

  return {
    status,
    error,
    inVoice,
    micMuted,
    joinVoice,
    leaveVoice,
    toggleMic,
    setLocalVolume,
    setLocalMuted,
    memberViews,
  }
}
