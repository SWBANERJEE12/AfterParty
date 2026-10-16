/**
 * Simulates 10 participants applying playback revisions (mock latency only).
 * NOT a browser or WebRTC test — reports synthetic p50/p95 processing time.
 * Run: npm run test:playback-latency-sim
 */
import { mergePlaybackState } from '../src/lib/playback/syncEngine.ts'
import { EMPTY_PLAYBACK_STATE } from '../src/shared/playback.ts'

const PARTICIPANTS = 10
const EVENTS = 200
const samples: number[] = []

let state = EMPTY_PLAYBACK_STATE('sim-room')

for (let i = 0; i < EVENTS; i++) {
  const revision = i + 1
  const patch = {
    revision,
    positionSec: i * 0.5,
    status: i % 2 === 0 ? ('playing' as const) : ('paused' as const),
    authoritativeTs: Date.now(),
  }
  const t0 = performance.now()
  for (let p = 0; p < PARTICIPANTS; p++) {
    state = mergePlaybackState(state, patch)
  }
  samples.push(performance.now() - t0)
}

samples.sort((a, b) => a - b)
const p50 = samples[Math.floor(samples.length * 0.5)]
const p95 = samples[Math.floor(samples.length * 0.95)]

console.log('Simulated playback state merge (10 participants x 200 events)')
console.log(`Network: N/A (in-process mock)`)
console.log(`p50 client apply batch: ${p50.toFixed(3)} ms`)
console.log(`p95 client apply batch: ${p95.toFixed(3)} ms`)
console.log('This does NOT measure Realtime propagation or multi-browser drift.')
