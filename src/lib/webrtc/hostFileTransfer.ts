/** Chunked P2P file transfer over a reliable RTCDataChannel (sequenced + acked). */

export const FILE_CHUNK_BYTES = 64 * 1024
export const MAX_DC_BUFFERED = 2 * 1024 * 1024
export const CHUNK_ACK_INTERVAL = 8
/** Full-file SHA-256 is skipped above this size to avoid blocking the main thread. */
export const FULL_HASH_MAX_BYTES = 48 * 1024 * 1024

export function sizeOnlyDigest(fileSize: number): string {
  return `size:${fileSize}`
}

export function isSizeOnlyDigest(digest: string): boolean {
  return digest.startsWith('size:')
}
const CHUNK_MAGIC = 0x4150434b // 'APCK'

export type FileMetaMessage = {
  kind: 'meta'
  sessionId: string
  transferId: string
  name: string
  size: number
  mime: string
  sha256: string
}

export type FileDoneMessage = {
  kind: 'done'
  sessionId: string
  transferId: string
  sha256: string
  size: number
}

export type FileAckMessage = {
  kind: 'ack'
  transferId: string
  upToIndex: number
}

export type FileCancelMessage = {
  kind: 'cancel'
  sessionId: string
  transferId: string
}

export type FileControlMessage = FileMetaMessage | FileDoneMessage | FileAckMessage | FileCancelMessage

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256HexForFile(file: Blob): Promise<string> {
  return sha256Hex(await file.arrayBuffer())
}

export function newTransferId(): string {
  return crypto.randomUUID()
}

function waitForOpen(dc: RTCDataChannel): Promise<void> {
  if (dc.readyState === 'open') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Data channel failed to open'))
    }
    const cleanup = () => {
      dc.removeEventListener('open', onOpen)
      dc.removeEventListener('error', onErr)
    }
    dc.addEventListener('open', onOpen)
    dc.addEventListener('error', onErr)
  })
}

function waitForBuffer(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount <= MAX_DC_BUFFERED) return Promise.resolve()
  return new Promise((resolve) => {
    const tick = () => {
      if (dc.bufferedAmount <= MAX_DC_BUFFERED) {
        dc.removeEventListener('bufferedamountlow', tick)
        resolve()
      }
    }
    dc.bufferedAmountLowThreshold = MAX_DC_BUFFERED / 2
    dc.addEventListener('bufferedamountlow', tick)
    tick()
  })
}

export function encodeChunkFrame(index: number, payload: ArrayBuffer): ArrayBuffer {
  const out = new ArrayBuffer(12 + payload.byteLength)
  const view = new DataView(out)
  view.setUint32(0, CHUNK_MAGIC, false)
  view.setUint32(4, index, false)
  view.setUint32(8, payload.byteLength, false)
  new Uint8Array(out, 12).set(new Uint8Array(payload))
  return out
}

export function decodeChunkFrame(
  data: ArrayBuffer,
): { index: number; payload: ArrayBuffer } | null {
  if (data.byteLength < 12) return null
  const view = new DataView(data)
  if (view.getUint32(0, false) !== CHUNK_MAGIC) return null
  const index = view.getUint32(4, false)
  const len = view.getUint32(8, false)
  if (len < 0 || 12 + len > data.byteLength) return null
  return { index, payload: data.slice(12, 12 + len) }
}

export async function sendFileOverDataChannel(
  file: File,
  dc: RTCDataChannel,
  sessionId: string,
  onProgress: (ratio: number, receivedBytes: number, totalBytes: number) => void,
  abortSignal?: AbortSignal,
  waitForAck?: (upToIndex: number) => Promise<void>,
): Promise<string> {
  await waitForOpen(dc)
  const transferId = newTransferId()
  const digest =
    file.size > FULL_HASH_MAX_BYTES ? sizeOnlyDigest(file.size) : await sha256HexForFile(file)
  const meta: FileMetaMessage = {
    kind: 'meta',
    sessionId,
    transferId,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    sha256: digest,
  }
  dc.send(JSON.stringify(meta))

  let offset = 0
  let index = 0
  while (offset < file.size) {
    if (abortSignal?.aborted) throw new Error('Transfer cancelled')
    await waitForBuffer(dc)
    const slice = file.slice(offset, offset + FILE_CHUNK_BYTES)
    const buf = await slice.arrayBuffer()
    dc.send(encodeChunkFrame(index, buf))
    offset += buf.byteLength
    index++
    onProgress(Math.min(1, offset / file.size), offset, file.size)
    if (waitForAck && index % CHUNK_ACK_INTERVAL === 0) {
      await waitForAck(index - 1)
    }
  }

  const done: FileDoneMessage = {
    kind: 'done',
    sessionId,
    transferId,
    sha256: digest,
    size: file.size,
  }
  dc.send(JSON.stringify(done))
  onProgress(1, file.size, file.size)
  return transferId
}

export type FileReceiveState = 'idle' | 'receiving' | 'verifying' | 'ready' | 'error'

export class FileReceiveSession {
  private meta: FileMetaMessage | null = null
  private chunks: Uint8Array[] = []
  private received = 0
  private nextIndex = 0
  state: FileReceiveState = 'idle'
  error: string | null = null
  progress = 0
  receivedBytes = 0
  totalBytes = 0
  activeTransferId: string | null = null
  activeSessionId: string | null = null

  onMeta(meta: FileMetaMessage) {
    this.meta = meta
    this.chunks = []
    this.received = 0
    this.receivedBytes = 0
    this.nextIndex = 0
    this.totalBytes = meta.size
    this.activeTransferId = meta.transferId
    this.activeSessionId = meta.sessionId
    this.state = 'receiving'
    this.error = null
    this.progress = 0
  }

  matchesTransfer(sessionId: string, transferId: string): boolean {
    return this.activeSessionId === sessionId && this.activeTransferId === transferId
  }

  shouldAcceptMeta(sessionId: string, transferId: string): boolean {
    if (!this.activeTransferId) return true
    if (this.activeSessionId === sessionId && this.activeTransferId === transferId) return true
    return false
  }

  getLastChunkIndex(): number {
    return this.nextIndex - 1
  }

  onChunkFrame(data: ArrayBuffer): boolean {
    if (!this.meta || this.state !== 'receiving') return false
    const frame = decodeChunkFrame(data)
    if (!frame) return false
    if (frame.index !== this.nextIndex) return false
    const u8 = new Uint8Array(frame.payload)
    this.chunks.push(u8)
    this.received += u8.byteLength
    this.receivedBytes = this.received
    this.nextIndex++
    this.progress = this.meta.size > 0 ? Math.min(1, this.received / this.meta.size) : 0
    if (this.received >= this.meta.size) this.state = 'verifying'
    return true
  }

  async finish(done: FileDoneMessage): Promise<Blob> {
    if (!this.meta) throw new Error('No file metadata')
    if (done.transferId !== this.meta.transferId || done.sessionId !== this.meta.sessionId) {
      throw new Error('Transfer ID mismatch')
    }
    if (this.received !== this.meta.size || done.size !== this.meta.size) {
      this.state = 'error'
      this.error = 'Incomplete file transfer.'
      throw new Error(this.error)
    }
    const blob = new Blob(this.chunks as BlobPart[], { type: this.meta.mime })
    if (isSizeOnlyDigest(this.meta.sha256)) {
      const expectedSize = Number.parseInt(this.meta.sha256.slice('size:'.length), 10)
      if (expectedSize !== this.meta.size) {
        this.state = 'error'
        this.error = 'File size metadata mismatch.'
        throw new Error(this.error)
      }
    } else {
      const actual = await sha256Hex(await blob.arrayBuffer())
      if (actual !== done.sha256 || actual !== this.meta.sha256) {
        this.state = 'error'
        this.error = 'File integrity check failed.'
        throw new Error(this.error)
      }
    }
    this.state = 'ready'
    this.progress = 1
    return blob
  }

  reset() {
    this.meta = null
    this.chunks = []
    this.received = 0
    this.receivedBytes = 0
    this.nextIndex = 0
    this.totalBytes = 0
    this.activeTransferId = null
    this.activeSessionId = null
    this.state = 'idle'
    this.error = null
    this.progress = 0
  }
}

export function parseControlMessage(raw: string): FileControlMessage | null {
  try {
    const j = JSON.parse(raw) as { kind?: string }
    if (j.kind === 'meta' || j.kind === 'done' || j.kind === 'ack' || j.kind === 'cancel') {
      return j as FileControlMessage
    }
  } catch {
    /* ignore */
  }
  return null
}
