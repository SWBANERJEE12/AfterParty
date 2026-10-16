import { useEffect, useRef, type MutableRefObject } from 'react'
import type { RoomPlaybackState } from '../shared/playback'
import { expectedPositionSec, isStaleAction, planDriftCorrection } from '../lib/playback/syncEngine'
import { DRIFT_HARD_MS, DRIFT_SOFT_MS } from '../shared/playback'

type Options = {
  enabled: boolean
  isHost: boolean
  clockOffsetMs: number
  state: RoomPlaybackState
  getVideo: () => HTMLVideoElement | null
  applyingRemote: MutableRefObject<boolean>
  onDrift: (driftMs: number, status: 'synced' | 'correcting') => void
  onApplyPlayPauseSeek: (status: RoomPlaybackState['status'], positionSec: number, rate: number) => void
}

export function useVideoPlaybackSync({
  enabled,
  isHost,
  clockOffsetMs,
  state,
  getVideo,
  applyingRemote,
  onDrift,
  onApplyPlayPauseSeek,
}: Options) {
  const lastActionRef = useRef({ revision: 0, actionId: null as string | null })
  const seekingRef = useRef(false)
  const sessionRef = useRef<string | null>(null)

  useEffect(() => {
    if (state.mediaSessionId !== sessionRef.current) {
      sessionRef.current = state.mediaSessionId
      lastActionRef.current = { revision: 0, actionId: null }
    }
  }, [state.mediaSessionId])

  useEffect(() => {
    if (!enabled) return
    const video = getVideo()
    if (!video) return
    if (
      isStaleAction(state.revision, state.actionId, lastActionRef.current.revision, lastActionRef.current.actionId)
    ) {
      return
    }
    lastActionRef.current = { revision: state.revision, actionId: state.actionId }
    const expected = expectedPositionSec(state, Date.now(), clockOffsetMs)
    onApplyPlayPauseSeek(state.status, expected, state.playbackRate)
  }, [enabled, state, clockOffsetMs, getVideo, onApplyPlayPauseSeek])

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      const video = getVideo()
      if (!video || video.readyState < 2) return
      if (seekingRef.current || state.status === 'buffering') return
      const expected = expectedPositionSec(state, Date.now(), clockOffsetMs)
      const actual = video.currentTime
      const plan = planDriftCorrection(expected, actual, state.status, true)
      const synced =
        plan.kind === 'none' && Math.abs(plan.driftMs) <= DRIFT_SOFT_MS && video.readyState >= 2
      onDrift(plan.driftMs, synced ? 'synced' : 'correcting')
      if (isHost) return
      if (plan.kind === 'seek' && Math.abs(plan.driftMs) > DRIFT_HARD_MS) {
        seekingRef.current = true
        applyingRemote.current = true
        video.currentTime = plan.positionSec
        window.setTimeout(() => {
          seekingRef.current = false
          applyingRemote.current = false
        }, 120)
      } else if (plan.kind === 'rate') {
        video.playbackRate = plan.rate
      } else if (plan.kind === 'none' && Math.abs(video.playbackRate - state.playbackRate) > 0.01) {
        video.playbackRate = state.playbackRate
      }
    }, 750)
    return () => window.clearInterval(id)
  }, [enabled, isHost, state, clockOffsetMs, getVideo, applyingRemote, onDrift])
}
