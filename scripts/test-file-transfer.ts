/**
 * Run: npm run test:file-transfer
 */
import {
  decodeChunkFrame,
  encodeChunkFrame,
  FileReceiveSession,
  sha256Hex,
} from '../src/lib/webrtc/hostFileTransfer.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

const payload = new TextEncoder().encode('afterparty-file-chunk-test')
const digest = await sha256Hex(payload.buffer)

const session = new FileReceiveSession()
session.onMeta({
  kind: 'meta',
  sessionId: 'sess',
  transferId: 't1',
  name: 't.bin',
  size: payload.byteLength,
  mime: 'application/octet-stream',
  sha256: digest,
})
const frame = encodeChunkFrame(0, payload.buffer)
ok('chunk frame decodes', decodeChunkFrame(frame)?.index === 0)
session.onChunkFrame(frame)
ok('receiving completes', session.state === 'verifying')
const blob = await session.finish({
  kind: 'done',
  sessionId: 'sess',
  transferId: 't1',
  sha256: digest,
  size: payload.byteLength,
})
ok('integrity ok', blob.size === payload.byteLength)

const dup = new FileReceiveSession()
dup.onMeta({
  kind: 'meta',
  sessionId: 'sess',
  transferId: 't1',
  name: 't.bin',
  size: payload.byteLength,
  mime: 'application/octet-stream',
  sha256: digest,
})
ok('out-of-order chunk ignored', !dup.onChunkFrame(encodeChunkFrame(1, payload.buffer)))
dup.onChunkFrame(encodeChunkFrame(0, payload.buffer))
ok('wrong order then correct', dup.getLastChunkIndex() === 0)

const bad = new FileReceiveSession()
bad.onMeta({
  kind: 'meta',
  sessionId: 'sess',
  transferId: 't1',
  name: 't.bin',
  size: payload.byteLength,
  mime: 'application/octet-stream',
  sha256: digest,
})
bad.onChunkFrame(frame)
let threw = false
try {
  await bad.finish({
    kind: 'done',
    sessionId: 'sess',
    transferId: 't1',
    sha256: '00',
    size: payload.byteLength,
  })
} catch {
  threw = true
}
ok('bad hash rejected', threw)

if (failed) process.exit(1)
console.log('\nAll file transfer unit tests passed.')
