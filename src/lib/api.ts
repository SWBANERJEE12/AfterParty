import type { MovieMeta } from '../shared/movies'

export type OmdbStatusResult =
  | { configured: true }
  | { configured: false; reason: 'not_configured' | 'api_unreachable' }

export async function fetchOmdbStatus(): Promise<OmdbStatusResult> {
  try {
    const res = await fetch('/api/omdb/status', { headers: { Accept: 'application/json' } })
    const contentType = res.headers.get('content-type') ?? ''
    if (!res.ok || !contentType.includes('application/json')) {
      return { configured: false, reason: 'api_unreachable' }
    }
    const data = (await res.json()) as { configured?: boolean }
    if (data.configured) return { configured: true }
    return { configured: false, reason: 'not_configured' }
  } catch {
    return { configured: false, reason: 'api_unreachable' }
  }
}

export async function searchOmdb(q: string): Promise<{ results: MovieMeta[]; error?: string }> {
  const res = await fetch(`/api/omdb/search?q=${encodeURIComponent(q)}`)
  const data = await res.json()
  if (!res.ok) return { results: [], error: data.error ?? 'Search failed' }
  return data
}

export async function fetchOmdbTitle(imdbId: string): Promise<{ movie?: MovieMeta; error?: string }> {
  const res = await fetch(`/api/omdb/title/${encodeURIComponent(imdbId)}`)
  const data = await res.json()
  if (!res.ok) return { error: data.error ?? 'Failed to load title' }
  return data
}

export type TrailerLookupResponse = {
  status: 'available' | 'unavailable' | 'not_configured' | 'error'
  videoId: string | null
  title?: string
  year?: string
  channelTitle?: string | null
  message?: string | null
  fromStaleCache?: boolean
  code?: string
}

const TRAILER_FETCH_MS = 25_000

export async function fetchTrailerStatus(): Promise<{ configured: boolean }> {
  const res = await fetch('/api/trailers/status')
  if (!res.ok) return { configured: false }
  return res.json()
}

export async function fetchMovieTrailer(imdbId: string): Promise<TrailerLookupResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TRAILER_FETCH_MS)
  try {
    const res = await fetch(`/api/trailers/${encodeURIComponent(imdbId)}`, {
      signal: controller.signal,
    })
    let data: TrailerLookupResponse
    try {
      data = (await res.json()) as TrailerLookupResponse
    } catch {
      return {
        status: 'error',
        videoId: null,
        message: 'Trailer unavailable. Invalid server response.',
      }
    }
    if (res.status === 503 && data.status === 'not_configured') {
      return {
        status: 'not_configured',
        videoId: null,
        message: data.message ?? 'Trailer unavailable. YouTube API key is not configured on the server.',
      }
    }
    if (!res.ok) {
      return {
        status: 'error',
        videoId: null,
        message: data.message ?? 'Trailer unavailable. Lookup failed.',
        code: data.code,
      }
    }
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        status: 'error',
        videoId: null,
        message: 'Trailer unavailable. Request timed out.',
      }
    }
    return {
      status: 'error',
      videoId: null,
      message: 'Trailer unavailable. Network error.',
    }
  } finally {
    window.clearTimeout(timer)
  }
}

export async function reportTrailerEmbedFailure(imdbId: string, videoId: string): Promise<void> {
  try {
    await fetch('/api/trailers/report-embed-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imdbId, videoId }),
    })
  } catch {
    // non-fatal
  }
}

export async function fetchOmdbRow(rowId: string): Promise<{ movies: MovieMeta[]; error?: string }> {
  const res = await fetch(`/api/omdb/row/${encodeURIComponent(rowId)}`)
  const data = await res.json()
  if (!res.ok) return { movies: [], error: data.error ?? 'Failed to load row' }
  return data
}

export type LivekitStatus = {
  configured: boolean
  url: string | null
  membershipCheck: boolean
}

export async function fetchLivekitStatus(): Promise<LivekitStatus> {
  const res = await fetch('/api/livekit/status')
  if (!res.ok) return { configured: false, url: null, membershipCheck: false }
  return res.json()
}

export async function fetchLivekitToken(
  roomId: string,
  memberKey: string,
  nickname: string,
): Promise<{ token: string; serverUrl: string; roomName: string } | { error: string }> {
  const res = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, memberKey, nickname }),
  })
  const data = await res.json()
  if (!res.ok) return { error: data.error ?? 'Could not join call' }
  return data
}
