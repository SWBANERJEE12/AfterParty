/** Serializes host playback RPCs and retries on optimistic stale revision conflicts. */

export type PlaybackRpcResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function isStaleRevisionError(message: string): boolean {
  return message.toLowerCase().includes('stale revision')
}

export async function runWithStaleRetry<T>(
  getExpectedRevision: () => number,
  refreshRevision: () => Promise<number>,
  invoke: (expectedRevision: number) => Promise<PlaybackRpcResult<T>>,
  maxAttempts = 4,
): Promise<PlaybackRpcResult<T>> {
  let expected = getExpectedRevision()
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await invoke(expected)
    if (res.ok) return res
    if (!isStaleRevisionError(res.error)) return res
    expected = await refreshRevision()
  }
  return { ok: false, error: 'Playback state changed too quickly. Try again.' }
}

export class SerialTaskQueue {
  private tail: Promise<void> = Promise.resolve()

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task)
    this.tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}
