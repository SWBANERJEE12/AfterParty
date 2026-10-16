/**
 * Run: npm run test:late-join-pending
 */
import { PendingPlaybackBuffer } from '../src/lib/playback/pendingPlaybackState.ts'
import { EMPTY_PLAYBACK_STATE } from '../src/shared/playback.ts'
import { expectedPositionSec } from '../src/lib/playback/syncEngine.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

const buf = new PendingPlaybackBuffer()
const s0 = { ...EMPTY_PLAYBACK_STATE('r'), revision: 2, positionSec: 10, status: 'playing' as const, authoritativeTs: 1000 }
const s1 = { ...s0, revision: 5, positionSec: 90, authoritativeTs: 2000 }
buf.update(s0)
buf.update(s1)
ok('keeps newest revision', buf.peek()?.revision === 5)

const joinSnap = { ...s0, revision: 3, positionSec: 40, authoritativeTs: 1500 }
const latest = buf.peek()!
ok('late join uses latest not join snapshot', latest.revision > joinSnap.revision)

const expected = expectedPositionSec(latest, 5000, 0)
ok('expected position after transfer uses latest state', expected > 90)

if (failed) process.exit(1)
console.log('\nAll late-join pending playback tests passed.')
