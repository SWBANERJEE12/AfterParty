import type { PlaybackActionType, PlaybackStatus, RoomPlaybackState } from '../../shared/playback'
import { DRIFT_HARD_MS, DRIFT_SOFT_MS } from '../../shared/playback'

export type DriftCorrection =
  | { kind: 'none'; driftMs: number }
  | { kind: 'rate'; driftMs: number; rate: number }
  | { kind: 'seek'; driftMs: number; positionSec: number }

export function expectedPositionSec(
  state: RoomPlaybackState,
  nowMs: number,
  clockOffsetMs: number,
): number {
  const serverNow = nowMs + clockOffsetMs
  const elapsed = Math.max(0, (serverNow - state.authoritativeTs) / 1000)
  if (state.status !== 'playing') return state.positionSec
  return state.positionSec + elapsed * state.playbackRate
}

export function shouldApplyRevision(incoming: number, current: number): boolean {
  return incoming > current
}

export function isStaleAction(
  incomingRevision: number,
  incomingActionId: string | null,
  lastAppliedRevision: number,
  lastAppliedActionId: string | null,
): boolean {
  if (incomingRevision < lastAppliedRevision) return true
  if (incomingRevision === lastAppliedRevision && incomingActionId === lastAppliedActionId) return true
  return false
}

export function planDriftCorrection(
  expectedSec: number,
  actualSec: number,
  status: PlaybackStatus,
  allowRateAdjust: boolean,
): DriftCorrection {
  const driftMs = (actualSec - expectedSec) * 1000
  const abs = Math.abs(driftMs)
  if (status === 'buffering') return { kind: 'none', driftMs }
  if (abs <= DRIFT_SOFT_MS) return { kind: 'none', driftMs }
  if (allowRateAdjust && abs < DRIFT_HARD_MS) {
    const rate = driftMs > 0 ? 0.95 : 1.05
    return { kind: 'rate', driftMs, rate }
  }
  return { kind: 'seek', driftMs, positionSec: Math.max(0, expectedSec) }
}

export function mergePlaybackState(
  prev: RoomPlaybackState,
  patch: Partial<RoomPlaybackState> & { revision: number },
): RoomPlaybackState {
  if (!shouldApplyRevision(patch.revision, prev.revision)) return prev
  return {
    ...prev,
    ...patch,
    roomId: prev.roomId,
  }
}

export function actionFromHost(
  type: PlaybackActionType,
  positionSec: number,
  revision: number,
): Pick<RoomPlaybackState, 'actionType' | 'positionSec' | 'revision'> {
  return { actionType: type, positionSec, revision }
}

export function clampPlaybackPosition(positionSec: number, durationSec: number | null): number {
  const pos = Math.max(0, positionSec)
  if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
    return Math.min(pos, durationSec)
  }
  return pos
}

/** Viewers should not stay stuck in room-level buffering without seeking. */
export function playbackStatusForViewerSync(status: PlaybackStatus): 'playing' | 'paused' {
  return status === 'playing' ? 'playing' : 'paused'
}

export function needsPlayerResync(
  incomingRevision: number,
  incomingActionId: string | null,
  lastSyncedRevision: number,
  lastSyncedActionId: string | null,
  playerHasSynced: boolean,
): boolean {
  if (!playerHasSynced) return true
  return !isStaleAction(
    incomingRevision,
    incomingActionId,
    lastSyncedRevision,
    lastSyncedActionId,
  )
}
