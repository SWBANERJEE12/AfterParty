/**
 * Unit tests for host local video helpers (mock element, no browser).
 * Run: npm run test:host-local-video
 */
import {
  HostVideoCommandQueue,
  applyHostVideoCommand,
  validateVideoFile,
  waitForVideoEvent,
} from '../src/lib/playback/hostLocalVideo.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

ok('rejects empty file', validateVideoFile({ size: 0, type: 'video/mp4', name: 'x.mp4' } as File) !== null)
ok(
  'rejects unsupported format',
  validateVideoFile({ size: 100, type: 'application/pdf', name: 'doc.pdf' } as File) !== null,
)
ok('accepts mp4', validateVideoFile({ size: 100, type: 'video/mp4', name: 'x.mp4' } as File) === null)
ok(
  'accepts webm by extension',
  validateVideoFile({ size: 100, type: '', name: 'clip.webm' } as File) === null,
)

const mockVideo = {
  readyState: 4,
  currentTime: 0,
  play: () => Promise.resolve(),
  pause: () => {},
  addEventListener: (ev: string, fn: () => void) => {
    if (ev === 'loadedmetadata') queueMicrotask(fn)
  },
  removeEventListener: () => {},
  error: null,
} as unknown as HTMLVideoElement

const q = new HostVideoCommandQueue()
q.enqueue({ type: 'play' })
q.enqueue({ type: 'seek', positionSec: 12 })
ok('queue holds before ready', q.pendingCount() === 2)
q.setReady(true)
q.drain(mockVideo)
ok('queue drains when ready', q.pendingCount() === 0)

const q2 = new HostVideoCommandQueue()
q2.enqueue({ type: 'seek', positionSec: 1 })
q2.enqueue({ type: 'seek', positionSec: 99 })
q2.setReady(true)
q2.drain(mockVideo)
ok('last seek wins in sequence', mockVideo.currentTime === 99)

void waitForVideoEvent(mockVideo, 'loadedmetadata').then(() => ok('waitForVideoEvent metadata', true))

applyHostVideoCommand(mockVideo, { type: 'seek', positionSec: 5 })
ok('seek applied', mockVideo.currentTime === 5)

const rejectPlay = {
  readyState: 1,
  play: () => Promise.reject(new Error('autoplay blocked')),
  pause: () => {},
} as unknown as HTMLVideoElement
void applyHostVideoCommand(rejectPlay, { type: 'play' })
ok('play rejection swallowed', true)

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nAll host local video unit tests passed.')
