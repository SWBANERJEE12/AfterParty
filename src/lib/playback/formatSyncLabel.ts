export function formatPlaybackSyncLabel(
  syncStatus: string,
  sourceType: string,
  realtimeConnected: boolean,
): string {
  if (sourceType === 'none') return 'No video selected'
  if (syncStatus === 'synced') return 'Synced'
  if (syncStatus === 'correcting') return 'Correcting drift'
  if (syncStatus === 'unknown' && sourceType !== 'none' && realtimeConnected) return 'Syncing'
  if (realtimeConnected) return 'Connecting'
  return 'Waiting for connection'
}

export function formatPlaybackStatusLabel(status: string, sourceType: string): string {
  if (sourceType === 'none') return 'Choose a source'
  if (status === 'playing') return 'Playing'
  if (status === 'paused') return 'Paused'
  if (status === 'buffering') return 'Buffering'
  return status
}
