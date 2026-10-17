export type HostVideoLoadResult =
  | { ok: true; objectUrl: string; durationSec: number | null }
  | { ok: false; error: string }

export type HostVideoCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; positionSec: number }

export class HostVideoCommandQueue {
  private ready = false
  private pending: HostVideoCommand[] = []

  setReady(ready: boolean) {
    this.ready = ready
  }

  enqueue(cmd: HostVideoCommand) {
    this.pending.push(cmd)
  }

  pendingCount(): number {
    return this.pending.length
  }

  drain(video: HTMLVideoElement): void {
    if (!this.ready) return
    const cmds = [...this.pending]
    this.pending = []
    for (const cmd of cmds) {
      applyHostVideoCommand(video, cmd)
    }
  }

  clear() {
    this.pending = []
    this.ready = false
  }
}

export function applyHostVideoCommand(video: HTMLVideoElement, cmd: HostVideoCommand): void {
  if (cmd.type === 'play') {
    void video.play().catch(() => {})
  } else if (cmd.type === 'pause') {
    video.pause()
  } else if (cmd.type === 'seek') {
    if (video.readyState >= 1) {
      video.currentTime = Math.max(0, cmd.positionSec)
    }
  }
}

export function waitForVideoEvent(
  video: HTMLVideoElement,
  event: 'loadedmetadata' | 'canplay' | 'error',
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (event === 'loadedmetadata' && video.readyState >= 1) {
      resolve()
      return
    }
    if (event === 'canplay' && video.readyState >= 3) {
      resolve()
      return
    }
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      const code = video.error?.code
      reject(new Error(code ? `Video error code ${code}` : 'Video failed to load'))
    }
    const cleanup = () => {
      video.removeEventListener(event, onOk)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener(event, onOk, { once: true })
    video.addEventListener('error', onErr, { once: true })
  })
}

export function validateVideoFile(file: File): string | null {
  if (!file.size) return 'Selected file is empty.'
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name)) {
    return 'Unsupported format. Choose a browser-compatible video file (e.g. MP4 or WebM).'
  }
  return null
}

export async function loadVideoFileIntoElement(
  video: HTMLVideoElement,
  file: File,
  previousObjectUrl: string | null,
): Promise<HostVideoLoadResult> {
  const invalid = validateVideoFile(file)
  if (invalid) return { ok: false, error: invalid }

  video.pause()
  video.removeAttribute('src')
  video.load()

  const objectUrl = URL.createObjectURL(file)
  video.srcObject = null
  video.src = objectUrl
  video.muted = true
  video.playsInline = true

  try {
    await waitForVideoEvent(video, 'loadedmetadata')
  } catch (e) {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load video metadata.',
    }
  }

  const durationSec = Number.isFinite(video.duration) ? video.duration : null
  if (previousObjectUrl && previousObjectUrl !== objectUrl) {
    URL.revokeObjectURL(previousObjectUrl)
  }
  return { ok: true, objectUrl, durationSec }
}

/** Re-bind an existing object URL after the <video> element remounts (e.g. route / portal). */
export async function reattachVideoObjectUrl(
  video: HTMLVideoElement,
  objectUrl: string,
): Promise<HostVideoLoadResult> {
  if (!objectUrl) return { ok: false, error: 'No video source URL.' }
  video.pause()
  video.srcObject = null
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  try {
    await waitForVideoEvent(video, 'loadedmetadata')
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reload video from saved source.',
    }
  }
  const durationSec = Number.isFinite(video.duration) ? video.duration : null
  return { ok: true, objectUrl, durationSec }
}

export async function loadVideoBlobIntoElement(
  video: HTMLVideoElement,
  blob: Blob,
  previousObjectUrl: string | null,
): Promise<HostVideoLoadResult> {
  if (!blob.size) return { ok: false, error: 'Received file is empty.' }

  video.pause()
  video.removeAttribute('src')
  video.load()
  const objectUrl = URL.createObjectURL(blob)
  video.srcObject = null
  video.src = objectUrl
  video.muted = false
  video.playsInline = true

  try {
    await waitForVideoEvent(video, 'loadedmetadata')
    await waitForVideoEvent(video, 'canplay')
  } catch (e) {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load received video.',
    }
  }

  const durationSec = Number.isFinite(video.duration) ? video.duration : null
  if (previousObjectUrl && previousObjectUrl !== objectUrl) {
    URL.revokeObjectURL(previousObjectUrl)
  }
  return { ok: true, objectUrl, durationSec }
}

export function captureStreamFromVideo(
  video: HTMLVideoElement,
): MediaStream | null {
  const cap = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream
  if (typeof cap !== 'function') return null
  try {
    return cap.call(video)
  } catch {
    return null
  }
}
