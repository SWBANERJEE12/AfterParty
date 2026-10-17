import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  HostVideoCommandQueue,
  loadVideoBlobIntoElement,
  loadVideoFileIntoElement,
  reattachVideoObjectUrl,
} from '../lib/playback/hostLocalVideo'
import { getIceServers } from '../lib/webrtc/iceServers'
import {
  CHUNK_ACK_INTERVAL,
  FileReceiveSession,
  parseControlMessage,
  sendFileOverDataChannel,
  type FileAckMessage,
} from '../lib/webrtc/hostFileTransfer'
import { MEDIA_SIGNAL_EVENT, mediaSignalId, type MediaSignal } from '../lib/webrtc/mediaSignaling'
import { playbackSyncTarget } from '../shared/playback'

export type MediaStreamStatus =
  | 'idle'
  | 'waiting_host'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'ended'

export type HostFileLoadState = 'idle' | 'loading' | 'ready' | 'error'
export type ViewerFileLoadState = 'idle' | 'transferring' | 'verifying' | 'ready' | 'error'

type PeerEntry = {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  transferAbort: AbortController | null
  activeTransferId: string | null
  lastAckResolver: ((index: number) => void) | null
}

const DATA_CHANNEL_LABEL = 'afterparty-file'

export function useHostMediaWebRTC(
  channel: RealtimeChannel | null,
  memberKey: string,
  isHost: boolean,
  hostMemberKey: string | null,
  mediaSessionId: string | null,
  sourceType: string,
  enabled: boolean,
  hostMediaPreparing: boolean,
  membershipReady: boolean,
) {
  const [status, setStatus] = useState<MediaStreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hostFileLoadState, setHostFileLoadState] = useState<HostFileLoadState>('idle')
  const [viewerFileLoadState, setViewerFileLoadState] = useState<ViewerFileLoadState>('idle')
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferBytesReceived, setTransferBytesReceived] = useState(0)
  const [transferBytesTotal, setTransferBytesTotal] = useState(0)
  const [hostFileName, setHostFileName] = useState<string | null>(null)
  const [hostDurationSec, setHostDurationSec] = useState<number | null>(null)
  const [viewerDurationSec, setViewerDurationSec] = useState<number | null>(null)

  const hostVideoElRef = useRef<HTMLVideoElement | null>(null)
  const viewerVideoElRef = useRef<HTMLVideoElement | null>(null)
  const hostFileUrlRef = useRef<string | null>(null)
  const viewerFileUrlRef = useRef<string | null>(null)
  const hostSourceFileRef = useRef<File | null>(null)
  const peersRef = useRef<Map<string, PeerEntry>>(new Map())
  const seenSignals = useRef(new Set<string>())
  const pendingFileRef = useRef<File | null>(null)
  const attachGenerationRef = useRef(0)
  const commandQueueRef = useRef(new HostVideoCommandQueue())
  const receiveSessionRef = useRef(new FileReceiveSession())
  const hostReadyRef = useRef(false)
  const pendingViewerBlobRef = useRef<Blob | null>(null)
  const activeSessionRef = useRef<string | null>(null)
  const viewerReadyCallbacksRef = useRef(new Set<() => void>())
  const requestFileTimerRef = useRef<number | null>(null)

  const sendSignal = useCallback(
    async (signal: MediaSignal) => {
      if (!channel) return
      await channel.send({ type: 'broadcast', event: MEDIA_SIGNAL_EVENT, payload: signal })
    },
    [channel],
  )

  const closePeer = useCallback((remoteKey: string) => {
    const entry = peersRef.current.get(remoteKey)
    if (!entry) return
    entry.transferAbort?.abort()
    entry.dc?.close()
    entry.pc.close()
    peersRef.current.delete(remoteKey)
  }, [])

  const stopPeerTransfers = useCallback(() => {
    for (const [key] of peersRef.current) closePeer(key)
  }, [closePeer])

  const teardown = useCallback(
    (revokeUrls = true) => {
      stopPeerTransfers()
      seenSignals.current.clear()
      commandQueueRef.current.clear()
      pendingFileRef.current = null
      pendingViewerBlobRef.current = null
      hostSourceFileRef.current = null
      receiveSessionRef.current.reset()
      activeSessionRef.current = null
      if (requestFileTimerRef.current != null) {
        window.clearInterval(requestFileTimerRef.current)
        requestFileTimerRef.current = null
      }
      if (revokeUrls) {
        if (hostFileUrlRef.current) {
          URL.revokeObjectURL(hostFileUrlRef.current)
          hostFileUrlRef.current = null
        }
        if (viewerFileUrlRef.current) {
          URL.revokeObjectURL(viewerFileUrlRef.current)
          viewerFileUrlRef.current = null
        }
      }
      const hostVideo = hostVideoElRef.current
      if (hostVideo) {
        hostVideo.pause()
        hostVideo.removeAttribute('src')
        hostVideo.load()
      }
      const viewerVideo = viewerVideoElRef.current
      if (viewerVideo) {
        viewerVideo.pause()
        viewerVideo.removeAttribute('src')
        viewerVideo.load()
      }
      hostReadyRef.current = false
      setHostFileLoadState('idle')
      setViewerFileLoadState('idle')
      setTransferProgress(0)
      setTransferBytesReceived(0)
      setTransferBytesTotal(0)
      setHostFileName(null)
      setHostDurationSec(null)
      setViewerDurationSec(null)
      setStatus('idle')
      setError(null)
    },
    [stopPeerTransfers],
  )

  const notifyViewerReady = useCallback(() => {
    for (const fn of viewerReadyCallbacksRef.current) fn()
  }, [])

  const onViewerFileReady = useCallback((cb: () => void) => {
    viewerReadyCallbacksRef.current.add(cb)
    return () => viewerReadyCallbacksRef.current.delete(cb)
  }, [])

  const tryLoadPendingViewerBlob = useCallback(async (): Promise<boolean> => {
    const blob = pendingViewerBlobRef.current
    const video = viewerVideoElRef.current
    if (!blob || !video) return false
    setViewerFileLoadState('verifying')
    const loaded = await loadVideoBlobIntoElement(video, blob, viewerFileUrlRef.current)
    if (!loaded.ok) {
      setViewerFileLoadState('error')
      setError(loaded.error)
      return false
    }
    viewerFileUrlRef.current = loaded.objectUrl
    pendingViewerBlobRef.current = null
    setViewerDurationSec(loaded.durationSec)
    setViewerFileLoadState('ready')
    setStatus('connected')
    notifyViewerReady()
    return true
  }, [notifyViewerReady])

  const startHostTransfer = useCallback(
    async (remoteKey: string, sessionId: string) => {
      const file = hostSourceFileRef.current
      let entry = peersRef.current.get(remoteKey)
      if (!file || !entry?.dc || !isHost) return
      if (entry.dc.readyState !== 'open') return

      entry.transferAbort?.abort()
      const abort = new AbortController()
      entry.transferAbort = abort
      entry.activeTransferId = null

      const waitForAck = (upToIndex: number) =>
        new Promise<void>((resolve) => {
          entry!.lastAckResolver = (idx) => {
            if (idx >= upToIndex) {
              entry!.lastAckResolver = null
              resolve()
            }
          }
          window.setTimeout(() => {
            entry!.lastAckResolver = null
            resolve()
          }, 8000)
        })

      try {
        const transferId = await sendFileOverDataChannel(
          file,
          entry.dc,
          sessionId,
          (ratio, received, total) => {
            if (!isHost) return
            setTransferProgress(ratio)
            setTransferBytesReceived(received)
            setTransferBytesTotal(total)
          },
          abort.signal,
          waitForAck,
        )
        entry.activeTransferId = transferId
      } catch (e) {
        if (!abort.signal.aborted) {
          setError(e instanceof Error ? e.message : 'File transfer failed')
          setStatus('failed')
        }
      }
    },
    [isHost],
  )

  const setupViewerChannel = useCallback(
    (dc: RTCDataChannel, sessionId: string) => {
      if (activeSessionRef.current !== sessionId) {
        receiveSessionRef.current.reset()
        activeSessionRef.current = sessionId
      }
      setViewerFileLoadState('transferring')
      setTransferProgress(0)
      setTransferBytesReceived(0)
      setTransferBytesTotal(0)
      setError(null)

      dc.onmessage = async (ev) => {
        if (typeof ev.data === 'string') {
          const ctrl = parseControlMessage(ev.data)
          if (!ctrl) return
          if (ctrl.kind === 'meta') {
            if (ctrl.sessionId !== sessionId) return
            const session = receiveSessionRef.current
            if (!session.shouldAcceptMeta(ctrl.sessionId, ctrl.transferId)) {
              session.reset()
            }
            session.onMeta(ctrl)
            setHostFileName(ctrl.name)
            setTransferBytesTotal(ctrl.size)
            setTransferBytesReceived(0)
            setTransferProgress(0)
          } else if (ctrl.kind === 'done') {
            try {
              const session = receiveSessionRef.current
              if (ctrl.sessionId !== sessionId || !session.matchesTransfer(ctrl.sessionId, ctrl.transferId)) {
                return
              }
              const blob = await session.finish(ctrl)
              pendingViewerBlobRef.current = blob
              const loaded = await tryLoadPendingViewerBlob()
              if (!loaded && !viewerVideoElRef.current) {
                setViewerFileLoadState('verifying')
              }
            } catch (err) {
              setViewerFileLoadState('error')
              setError(err instanceof Error ? err.message : 'Could not verify file')
            }
          } else if (ctrl.kind === 'cancel') {
            if (ctrl.sessionId === sessionId) {
              receiveSessionRef.current.reset()
              setViewerFileLoadState('transferring')
            }
          }
          return
        }
        if (ev.data instanceof ArrayBuffer) {
          const session = receiveSessionRef.current
          if (session.onChunkFrame(ev.data)) {
            setTransferProgress(session.progress)
            setTransferBytesReceived(session.receivedBytes)
            const lastIdx = session.getLastChunkIndex()
            if (lastIdx >= 0 && (lastIdx + 1) % CHUNK_ACK_INTERVAL === 0 && session.activeTransferId) {
              const ack: FileAckMessage = {
                kind: 'ack',
                transferId: session.activeTransferId,
                upToIndex: lastIdx,
              }
              dc.send(JSON.stringify(ack))
            }
          }
        }
      }
    },
    [tryLoadPendingViewerBlob],
  )

  const ensurePc = useCallback(
    (remoteKey: string, sessionId: string, forceNew = false) => {
      if (forceNew) closePeer(remoteKey)
      let entry = peersRef.current.get(remoteKey)
      if (entry) return entry.pc

      const pc = new RTCPeerConnection({ iceServers: getIceServers() })
      entry = { pc, dc: null, transferAbort: null, activeTransferId: null, lastAckResolver: null }
      peersRef.current.set(remoteKey, entry)

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        void sendSignal({
          type: 'ice',
          from: memberKey,
          to: remoteKey,
          sessionId,
          candidate: ev.candidate.toJSON(),
        })
      }

      if (isHost) {
        const dc = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true })
        entry.dc = dc
        dc.onopen = () => {
          if (hostReadyRef.current && hostSourceFileRef.current) {
            void startHostTransfer(remoteKey, sessionId)
          }
        }
        dc.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return
          const ctrl = parseControlMessage(ev.data)
          if (ctrl?.kind === 'ack') {
            entry?.lastAckResolver?.(ctrl.upToIndex)
          }
        }
      } else {
        pc.ondatachannel = (ev) => {
          if (ev.channel.label !== DATA_CHANNEL_LABEL) return
          entry!.dc = ev.channel
          setupViewerChannel(ev.channel, sessionId)
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (!isHost) {
            setStatus('failed')
            setError('Connection to host lost. Rejoin or wait for host to reconnect.')
          }
        } else if (pc.connectionState === 'connected' && !isHost) {
          setStatus('connecting')
        }
      }

      return pc
    },
    [isHost, memberKey, sendSignal, startHostTransfer, setupViewerChannel, closePeer],
  )

  const negotiateWithViewer = useCallback(
    async (viewerKey: string, sessionId: string) => {
      const pc = ensurePc(viewerKey, sessionId, true)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal({
        type: 'offer',
        from: memberKey,
        to: viewerKey,
        sessionId,
        sdp: offer,
      })
    },
    [ensurePc, memberKey, sendSignal],
  )

  const connectViewerStable = useCallback(
    async (viewerKey: string, sessionId: string) => {
      closePeer(viewerKey)
      await negotiateWithViewer(viewerKey, sessionId)
    },
    [closePeer, negotiateWithViewer],
  )

  const requestFileFromHost = useCallback(() => {
    if (isHost || !hostMemberKey || !mediaSessionId || !channel) return
    void sendSignal({
      type: 'request_file',
      from: memberKey,
      to: hostMemberKey,
      sessionId: mediaSessionId,
    })
  }, [isHost, hostMemberKey, mediaSessionId, channel, memberKey, sendSignal])

  const runAttachPendingFile = useCallback(async (): Promise<
    { ok: true; durationSec: number | null } | { ok: false; error: string }
  > => {
    const file = pendingFileRef.current
    const video = hostVideoElRef.current
    if (!file) return { ok: false, error: 'No file selected.' }
    if (!video) return { ok: false, error: 'Video element not ready.' }

    const gen = ++attachGenerationRef.current
    setHostFileLoadState('loading')
    setError(null)

    const loaded = await loadVideoFileIntoElement(video, file, hostFileUrlRef.current)
    if (gen !== attachGenerationRef.current) {
      if (loaded.ok) URL.revokeObjectURL(loaded.objectUrl)
      return { ok: false, error: 'File load superseded.' }
    }

    if (!loaded.ok) {
      setHostFileLoadState('error')
      setError(loaded.error)
      pendingFileRef.current = null
      return { ok: false, error: loaded.error }
    }

    hostFileUrlRef.current = loaded.objectUrl
    hostSourceFileRef.current = file
    commandQueueRef.current.setReady(true)
    commandQueueRef.current.drain(video)

    hostReadyRef.current = true
    setHostFileLoadState('ready')
    setHostDurationSec(loaded.durationSec)
    setStatus('connecting')
    pendingFileRef.current = null

    if (mediaSessionId) {
      for (const remoteKey of peersRef.current.keys()) {
        void startHostTransfer(remoteKey, mediaSessionId)
      }
    }

    return { ok: true, durationSec: loaded.durationSec }
  }, [mediaSessionId, startHostTransfer])

  const reattachHostVideoIfNeeded = useCallback(
    async (video: HTMLVideoElement) => {
      const file = hostSourceFileRef.current
      const url = hostFileUrlRef.current
      if (!file && !url) return
      if (url && hostReadyRef.current) {
        const loaded = await reattachVideoObjectUrl(video, url)
        if (loaded.ok) {
          hostFileUrlRef.current = loaded.objectUrl
          commandQueueRef.current.setReady(true)
          commandQueueRef.current.drain(video)
          setHostFileLoadState('ready')
          setHostDurationSec(loaded.durationSec)
          setError(null)
          return
        }
      }
      if (file) {
        pendingFileRef.current = file
        await runAttachPendingFile()
      }
    },
    [runAttachPendingFile],
  )

  const setHostVideoElement = useCallback(
    (el: HTMLVideoElement | null) => {
      hostVideoElRef.current = el
      if (!el) return
      if (pendingFileRef.current) {
        void runAttachPendingFile()
        return
      }
      if (hostSourceFileRef.current || hostFileUrlRef.current) {
        void reattachHostVideoIfNeeded(el)
      }
    },
    [runAttachPendingFile, reattachHostVideoIfNeeded],
  )

  const setViewerVideoElement = useCallback(
    (el: HTMLVideoElement | null) => {
      viewerVideoElRef.current = el
      if (el && pendingViewerBlobRef.current) void tryLoadPendingViewerBlob()
    },
    [tryLoadPendingViewerBlob],
  )

  const prepareHostFile = useCallback(
    (file: File) => {
      if (!isHost) return
      pendingFileRef.current = file
      hostSourceFileRef.current = file
      setHostFileName(file.name)
      setHostFileLoadState('loading')
      setHostDurationSec(null)
      if (hostVideoElRef.current) void runAttachPendingFile()
    },
    [isHost, runAttachPendingFile],
  )

  const applyHostPlaybackToVideo = useCallback(
    (type: 'play' | 'pause' | 'seek', positionSec?: number) => {
      const video = hostVideoElRef.current
      if (!video || hostFileLoadState !== 'ready') {
        if (type === 'play') commandQueueRef.current.enqueue({ type: 'play' })
        if (type === 'pause') commandQueueRef.current.enqueue({ type: 'pause' })
        if (type === 'seek' && positionSec != null) {
          commandQueueRef.current.enqueue({ type: 'seek', positionSec })
        }
        return
      }
      if (type === 'play') void video.play().catch(() => {})
      else if (type === 'pause') video.pause()
      else if (type === 'seek' && positionSec != null && video.readyState >= 1) {
        video.currentTime = positionSec
      }
    },
    [hostFileLoadState],
  )

  const applyViewerPlaybackToVideo = useCallback(
    (type: 'play' | 'pause' | 'seek', positionSec?: number, rate = 1) => {
      const video = viewerVideoElRef.current
      if (!video || viewerFileLoadState !== 'ready') return
      video.playbackRate = rate
      if (type === 'seek' && positionSec != null && video.readyState >= 1) {
        video.currentTime = positionSec
      }
      if (type === 'play') void video.play().catch(() => {})
      else if (type === 'pause') video.pause()
    },
    [viewerFileLoadState],
  )

  const webrtcActive = enabled || hostMediaPreparing

  useEffect(() => {
    if (sourceType !== 'host_media' && !hostMediaPreparing) {
      teardown()
    }
  }, [sourceType, hostMediaPreparing, teardown])

  useEffect(() => {
    if (mediaSessionId && mediaSessionId !== activeSessionRef.current && !isHost) {
      receiveSessionRef.current.reset()
      pendingViewerBlobRef.current = null
      setViewerFileLoadState('idle')
      activeSessionRef.current = mediaSessionId
      if (hostMemberKey) closePeer(hostMemberKey)
    }
  }, [mediaSessionId, isHost, hostMemberKey, closePeer])

  useEffect(() => {
    if (!webrtcActive || sourceType !== 'host_media' || !channel || !membershipReady) return

    if (!isHost && !hostMemberKey) {
      setStatus('waiting_host')
      return
    }

    const sendViewerHello = () => {
      if (isHost || !mediaSessionId || !hostMemberKey) return
      setStatus('connecting')
      void sendSignal({
        type: 'hello',
        from: memberKey,
        sessionId: mediaSessionId,
        role: 'viewer',
      })
      requestFileFromHost()
    }

    sendViewerHello()
    if (!isHost && mediaSessionId) {
      requestFileTimerRef.current = window.setInterval(sendViewerHello, 4000)
    }

    let active = true
    const onSignal = async (msg: { payload: MediaSignal }) => {
      if (!active) return
      const signal = msg.payload
      const id = mediaSignalId(signal)
      if (seenSignals.current.has(id)) return
      seenSignals.current.add(id)
      if (seenSignals.current.size > 800) seenSignals.current.clear()

      if (signal.type === 'session_end' && signal.sessionId === mediaSessionId) {
        teardown()
        setStatus('ended')
        return
      }

      if (
        isHost &&
        mediaSessionId &&
        'sessionId' in signal &&
        signal.sessionId === mediaSessionId &&
        ((signal.type === 'hello' && signal.role === 'viewer') ||
          (signal.type === 'request_file' && signal.to === memberKey))
      ) {
        const viewerKey = signal.from
        const viewers = peersRef.current.size
        if (viewers >= playbackSyncTarget()) {
          setError(`More than ${playbackSyncTarget()} viewers not supported for host media.`)
          return
        }
        if (hostReadyRef.current && hostSourceFileRef.current) {
          await connectViewerStable(viewerKey, mediaSessionId)
        } else {
          await negotiateWithViewer(viewerKey, mediaSessionId)
        }
        return
      }

      if (signal.type === 'hello' || signal.type === 'request_file' || signal.type === 'leave') return

      if ('to' in signal && signal.to !== memberKey) return
      if (mediaSessionId && 'sessionId' in signal && signal.sessionId !== mediaSessionId) return

      const sid = 'sessionId' in signal ? signal.sessionId : mediaSessionId ?? ''
      const remoteKey = signal.from

      if (signal.type === 'offer') {
        if (!isHost) {
          closePeer(remoteKey)
        }
        const pc = ensurePc(remoteKey, sid)
        await pc.setRemoteDescription(signal.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal({
          type: 'answer',
          from: memberKey,
          to: signal.from,
          sessionId: signal.sessionId,
          sdp: answer,
        })
        return
      }

      const pc = ensurePc(remoteKey, sid)

      if (signal.type === 'answer') {
        await pc.setRemoteDescription(signal.sdp)
      } else if (signal.type === 'ice') {
        try {
          await pc.addIceCandidate(signal.candidate)
        } catch {
          /* ignore late ice */
        }
      }
    }

    ;(channel as { on: (t: string, f: object, cb: (p: unknown) => void) => void }).on(
      'broadcast',
      { event: MEDIA_SIGNAL_EVENT },
      onSignal as (p: unknown) => void,
    )
    return () => {
      active = false
      if (requestFileTimerRef.current != null) {
        window.clearInterval(requestFileTimerRef.current)
        requestFileTimerRef.current = null
      }
    }
  }, [
    channel,
    webrtcActive,
    membershipReady,
    hostMemberKey,
    isHost,
    mediaSessionId,
    memberKey,
    sourceType,
    sendSignal,
    teardown,
    negotiateWithViewer,
    connectViewerStable,
    ensurePc,
    requestFileFromHost,
    closePeer,
  ])

  return {
    status,
    error,
    hostFileLoadState,
    viewerFileLoadState,
    transferProgress,
    transferBytesReceived,
    transferBytesTotal,
    hostFileName,
    viewerVideoRef: setViewerVideoElement,
    setHostVideoElement,
    prepareHostFile,
    hostDurationSec,
    viewerDurationSec,
    getHostVideoCurrentTime: () => hostVideoElRef.current?.currentTime ?? null,
    getViewerVideoCurrentTime: () => viewerVideoElRef.current?.currentTime ?? null,
    applyHostPlaybackToVideo,
    applyViewerPlaybackToVideo,
    onViewerFileReady,
    requestFileFromHost,
    teardown,
  }
}
