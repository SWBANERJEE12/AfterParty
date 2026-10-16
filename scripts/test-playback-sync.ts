/**
 * Unit tests for playback sync engine (no browser / WebRTC).
 * Run: npm run test:playback-sync
 */
import {
  expectedPositionSec,
  isStaleAction,
  mergePlaybackState,
  planDriftCorrection,
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

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nAll playback sync unit tests passed.')
