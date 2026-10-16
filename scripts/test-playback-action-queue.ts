/**
 * Run: npm run test:playback-action-queue
 */
import { isStaleRevisionError, runWithStaleRetry, SerialTaskQueue } from '../src/lib/playback/playbackActionQueue.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

ok('detects stale revision', isStaleRevisionError('stale revision'))

let revision = 3
const calls: number[] = []
const res = await runWithStaleRetry(
  () => revision,
  async () => {
    revision = 5
    return revision
  },
  async (expected) => {
    calls.push(expected)
    if (expected < 5) return { ok: false, error: 'stale revision' }
    return { ok: true, value: expected }
  },
)
ok('retries after stale', res.ok && res.value === 5)
ok('first attempt used cached revision', calls[0] === 3)

const q = new SerialTaskQueue()
const order: number[] = []
await q.enqueue(async () => {
  order.push(1)
  await new Promise((r) => setTimeout(r, 20))
})
await q.enqueue(async () => {
  order.push(2)
})
ok('serial queue ordering', order.join() === '1,2')

if (failed) process.exit(1)
console.log('\nAll playback action queue tests passed.')
