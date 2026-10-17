/**
 * Unit tests for playback sync engine (no browser / WebRTC).
 * Run: npm run test:playback-sync
 */
import {
  clampPlaybackPosition,
  expectedPositionSec,
  isStaleAction,
  mergePlaybackState,
  needsPlayerResync,
  planDriftCorrection,
  playbackStatusForViewerSync,
  shouldApplyRevision,
} from '../src/lib/playback/syncEngine.ts'
import { EMPTY_PLAYBACK_STATE } from '../src/shared/playback.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

const base = {
  ...EMPTY_PLAYBACK_STATE('room1'),
  revision: 5,
  positionSec: 100,
  status: 'playing' as const,
  authoritativeTs: 1000,
  playbackRate: 1,
}

ok('revision monotonic', shouldApplyRevision(6, 5) && !shouldApplyRevision(4, 5))

const expected = expectedPositionSec(
  { ...base, positionSec: 10, authoritativeTs: 0, status: 'playing' },
  5000,
  0,
)
ok('expected position advances while playing', Math.abs(expected - 15) < 0.01)

ok('stale duplicate action', isStaleAction(5, 'a', 5, 'a'))
ok('new revision not stale', !isStaleAction(6, 'b', 5, 'a'))
ok('same revision new action applies', !isStaleAction(5, 'b', 5, 'a'))

const behind = planDriftCorrection(109, 44, 'playing', false)
ok('large behind seeks forward', behind.kind === 'seek' && behind.positionSec > 100)

const merged = mergePlaybackState(base, { revision: 6, positionSec: 120 })
ok('merge applies higher revision', merged.positionSec === 120)

const drift = planDriftCorrection(50, 50.05, 'playing', true)
ok('small drift no correction', drift.kind === 'none')

const hard = planDriftCorrection(50, 52, 'playing', false)
ok('large drift seeks', hard.kind === 'seek')

ok('clamp position to duration', clampPlaybackPosition(200, 120) === 120)
ok('buffering maps to paused for viewer sync', playbackStatusForViewerSync('buffering') === 'paused')
ok('needs resync before first player sync', needsPlayerResync(3, 'a', 3, 'a', false))
ok('skip resync when already synced same action', !needsPlayerResync(3, 'a', 3, 'a', true))
ok('resync on newer revision', needsPlayerResync(4, 'b', 3, 'a', true))

const lateJoinExpected = expectedPositionSec(
  {
    ...EMPTY_PLAYBACK_STATE('r'),
    positionSec: 60,
    authoritativeTs: Date.now() - 13_000,
    status: 'playing',
    playbackRate: 1,
    revision: 10,
  },
  Date.now(),
  0,
)
ok('late join extrapolates playing position', Math.abs(lateJoinExpected - 73) < 1)

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nAll playback sync unit tests passed.')
