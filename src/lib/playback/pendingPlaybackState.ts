import type { RoomPlaybackState } from '../../shared/playback'

/** Keeps the newest authoritative playback row while media transfer is in progress. */
export class PendingPlaybackBuffer {
  private latest: RoomPlaybackState | null = null

  update(incoming: RoomPlaybackState) {
    if (!this.latest || incoming.revision > this.latest.revision) {
      this.latest = incoming
    }
  }

  peek(): RoomPlaybackState | null {
    return this.latest
  }

  clear() {
    this.latest = null
  }
}
