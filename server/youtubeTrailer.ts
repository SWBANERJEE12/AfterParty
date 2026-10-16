import { isEnvSet } from './loadEnv.ts'

const YOUTUBE_SEARCH = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos'

const TRAILER_HIT_TTL_MS = 24 * 60 * 60 * 1000
const TRAILER_MISS_TTL_MS = 6 * 60 * 60 * 1000

export type TrailerResolveResult = {
  status: 'available' | 'unavailable'
  videoId: string | null
  channelTitle?: string
  message?: string
  fromStaleCache?: boolean
}

type CacheEntry = { at: number; result: TrailerResolveResult }

const trailerCache = new Map<string, CacheEntry>()

export type TrailerApiErrorCode = 'quota_exceeded' | 'invalid_key' | 'network' | 'api_error'

export class TrailerApiError extends Error {
  readonly code: TrailerApiErrorCode
  constructor(code: TrailerApiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

type YoutubeSearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    channelTitle?: string
  }
}

type YoutubeSearchResponse = {
  items?: YoutubeSearchItem[]
  error?: { message?: string; code?: number; errors?: { reason?: string }[] }
}

type YoutubeVideosResponse = {
  items?: {
    id?: string
    status?: {
      embeddable?: boolean
      privacyStatus?: string
      uploadStatus?: string
    }
  }[]
  error?: { message?: string; errors?: { reason?: string }[] }
}

export function youtubeConfigured(): boolean {
  return isEnvSet('YOUTUBE_API_KEY')
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  if (!key) throw new TrailerApiError('invalid_key', 'YOUTUBE_API_KEY missing')
  return key
}

function parseYoutubeApiError(data: YoutubeSearchResponse | YoutubeVideosResponse, httpStatus: number): TrailerApiError {
  const reasons = data.error?.errors?.map((e) => e.reason).filter(Boolean) ?? []
  const msg = data.error?.message ?? `YouTube API error (${httpStatus})`
  const lower = msg.toLowerCase()

  if (reasons.includes('quotaExceeded') || lower.includes('quota')) {
    return new TrailerApiError('quota_exceeded', 'YouTube API quota exceeded.')
  }
  if (
    reasons.includes('keyInvalid') ||
    reasons.includes('accessNotConfigured') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key')
  ) {
    return new TrailerApiError('invalid_key', 'YouTube API key is invalid or not enabled.')
  }
  return new TrailerApiError('api_error', msg)
}

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function titleTokens(title: string): string[] {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for'])
  return normalizeTitle(title)
    .split(' ')
    .filter((w) => w.length > 2 && !stop.has(w))
}

function extractYear(text: string): string | null {
  const m = text.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : null
}

export function movieYearDigits(releaseYear: string): string | null {
  const m = releaseYear.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : null
}

export function scoreCandidate(
  movieTitle: string,
  movieYear: string,
  snippet: { title: string; description: string; channelTitle: string },
): number {
  let score = 0
  const vidTitle = snippet.title.toLowerCase()
  const desc = snippet.description.toLowerCase()
  const channel = snippet.channelTitle.toLowerCase()
  const normMovie = normalizeTitle(movieTitle)
  const normVid = normalizeTitle(snippet.title)
  const tokens = titleTokens(movieTitle)

  if (/\btrailer\b/.test(vidTitle)) score += 14
  if (/\bofficial\b/.test(vidTitle)) score += 10
  if (/\bofficial\b/.test(channel)) score += 8

  if (
    /\b(reaction|review|explained|recap|ending explained|full movie|watch online|free movie|hd movie)\b/.test(
      vidTitle,
    )
  ) {
    score -= 50
  }
  if (/\b(behind the scenes|bts|clip|featurette)\b/.test(vidTitle)) score -= 8
  if (/\bteaser\b/.test(vidTitle) && !/\btrailer\b/.test(vidTitle)) score -= 4

  let matched = 0
  for (const t of tokens) {
    if (normVid.includes(t) || desc.includes(t)) matched++
  }
  if (tokens.length > 0) score += (matched / tokens.length) * 32

  if (normVid.includes(normMovie) || normMovie.includes(normVid.split(' official')[0] ?? '')) {
    score += 18
  }

  const year = movieYearDigits(movieYear)
  if (year) {
    if (vidTitle.includes(year) || desc.includes(year)) score += 16
    const vidYear = extractYear(vidTitle)
    if (vidYear && vidYear !== year) score -= 28
  }

  if (
    /\b(sony pictures|universal pictures|warner|disney|paramount|lionsgate|mgm|netflix|amazon|focus features|a24)\b/.test(
      channel,
    )
  ) {
    score += 6
  }

  return score
}

export const MIN_ACCEPT_SCORE = 40

export type RankedCandidate = { videoId: string; channelTitle: string; score: number }

export function rankCandidates(
  movieTitle: string,
  movieYear: string,
  items: YoutubeSearchItem[],
): RankedCandidate[] {
  const ranked: RankedCandidate[] = []
  for (const item of items) {
    const videoId = item.id?.videoId
    const title = item.snippet?.title?.trim()
    if (!videoId || !title) continue
    const snippet = {
      title,
      description: item.snippet?.description?.trim() ?? '',
      channelTitle: item.snippet?.channelTitle?.trim() ?? '',
    }
    const score = scoreCandidate(movieTitle, movieYear, snippet)
    if (score >= MIN_ACCEPT_SCORE) {
      ranked.push({ videoId, channelTitle: snippet.channelTitle, score })
    }
  }
  ranked.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  return ranked.filter((c) => {
    if (seen.has(c.videoId)) return false
    seen.add(c.videoId)
    return true
  })
}

function getFreshCache(cacheKey: string): TrailerResolveResult | null {
  const hit = trailerCache.get(cacheKey)
  if (!hit) return null
  const ttl = hit.result.status === 'available' ? TRAILER_HIT_TTL_MS : TRAILER_MISS_TTL_MS
  if (Date.now() - hit.at < ttl) return hit.result
  return null
}

/** Any cached successful trailer, even past TTL — used when YouTube API is down. */
export function getStaleAvailableTrailer(imdbId: string): TrailerResolveResult | null {
  const hit = trailerCache.get(imdbId.toLowerCase())
  if (!hit || hit.result.status !== 'available' || !hit.result.videoId) return null
  return hit.result
}

async function youtubeSearch(query: string): Promise<YoutubeSearchItem[]> {
  const url = new URL(YOUTUBE_SEARCH)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '5')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('q', query.slice(0, 120))
  url.searchParams.set('key', apiKey())

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new TrailerApiError('network', 'Could not reach YouTube API.')
  }

  const data = (await res.json()) as YoutubeSearchResponse
  if (!res.ok) throw parseYoutubeApiError(data, res.status)
  return data.items ?? []
}

async function isVideoEmbeddable(videoId: string): Promise<boolean> {
  const url = new URL(YOUTUBE_VIDEOS)
  url.searchParams.set('part', 'status')
  url.searchParams.set('id', videoId)
  url.searchParams.set('key', apiKey())

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new TrailerApiError('network', 'Could not reach YouTube API.')
  }

  const data = (await res.json()) as YoutubeVideosResponse
  if (!res.ok) throw parseYoutubeApiError(data, res.status)

  const item = data.items?.[0]
  if (!item?.status) return false
  if (item.status.privacyStatus !== 'public') return false
  if (item.status.embeddable === false) return false
  if (item.status.uploadStatus && item.status.uploadStatus === 'deleted') return false
  return true
}

async function lookupFromYouTube(
  title: string,
  releaseYear: string,
): Promise<TrailerResolveResult> {
  const year = movieYearDigits(releaseYear) ?? releaseYear.trim()
  const queries = [
    `${title} ${year} official trailer`,
    `${title} official movie trailer`,
    `${title} ${year} trailer`,
  ]

  const byId = new Map<string, RankedCandidate>()
  for (const q of queries) {
    const items = await youtubeSearch(q)
    for (const c of rankCandidates(title, releaseYear, items)) {
      const prev = byId.get(c.videoId)
      if (!prev || c.score > prev.score) byId.set(c.videoId, c)
    }
    const top = [...byId.values()].sort((a, b) => b.score - a.score)[0]
    if (top && top.score >= MIN_ACCEPT_SCORE + 12) break
  }

  const candidates = [...byId.values()].sort((a, b) => b.score - a.score)

  for (const candidate of candidates) {
    const ok = await isVideoEmbeddable(candidate.videoId)
    if (ok) {
      return {
        status: 'available',
        videoId: candidate.videoId,
        channelTitle: candidate.channelTitle,
      }
    }
  }

  return {
    status: 'unavailable',
    videoId: null,
    message: 'No matching embeddable trailer found for this title.',
  }
}

export async function resolveTrailerForMovie(
  imdbId: string,
  title: string,
  releaseYear: string,
): Promise<TrailerResolveResult> {
  const cacheKey = imdbId.toLowerCase()
  const fresh = getFreshCache(cacheKey)
  if (fresh) return fresh

  try {
    const result = await lookupFromYouTube(title, releaseYear)
    trailerCache.set(cacheKey, { at: Date.now(), result })
    return result
  } catch (err) {
    const stale = getStaleAvailableTrailer(imdbId)
    if (stale) {
      return { ...stale, fromStaleCache: true }
    }
    throw err
  }
}

/** Mark a cached video as bad (e.g. client embed failure) so next lookup tries again. */
export function invalidateCachedTrailer(imdbId: string, videoId: string) {
  const cacheKey = imdbId.toLowerCase()
  const hit = trailerCache.get(cacheKey)
  if (hit?.result.videoId === videoId) {
    trailerCache.set(cacheKey, {
      at: Date.now(),
      result: {
        status: 'unavailable',
        videoId: null,
        message: 'Cached trailer is no longer playable.',
      },
    })
  }
}
