import type { Request, Response } from 'express'
import { fetchByImdbId } from './omdb.js'
import { YOUTUBE_KEY_SETUP_HINT, getServerConfigDiagnostic } from './serverConfig.js'
import {
  TrailerApiError,
  getStaleAvailableTrailer,
  invalidateCachedTrailer,
  resolveTrailerForMovie,
  youtubeConfigured,
} from './youtubeTrailer.js'

const CACHE_TTL_MS = 5 * 60 * 1000
const titleCache = new Map<string, { at: number; movie: Awaited<ReturnType<typeof fetchByImdbId>> }>()

async function movieForImdb(imdbId: string) {
  const hit = titleCache.get(imdbId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.movie
  const movie = await fetchByImdbId(imdbId)
  titleCache.set(imdbId, { at: Date.now(), movie })
  return movie
}

function apiErrorResponse(err: TrailerApiError) {
  const messages: Record<TrailerApiError['code'], string> = {
    quota_exceeded: 'Trailer unavailable. YouTube API quota exceeded.',
    invalid_key: 'Trailer unavailable. YouTube API key is invalid or not enabled.',
    network: 'Trailer unavailable. Could not reach YouTube.',
    api_error: 'Trailer unavailable. YouTube lookup failed.',
  }
  return {
    status: 'error' as const,
    code: err.code,
    videoId: null,
    message: messages[err.code] ?? 'Trailer unavailable.',
  }
}

export function trailerStatus(_req: Request, res: Response) {
  const configured = youtubeConfigured()
  const diag = getServerConfigDiagnostic()
  res.json({
    configured,
    hint: configured ? null : YOUTUBE_KEY_SETUP_HINT,
    envFilesPresent: diag.envFilesPresent,
  })
}

export async function trailerByImdbId(req: Request, res: Response) {
  const imdbId = typeof req.params.imdbId === 'string' ? req.params.imdbId.trim() : ''
  if (!/^tt\d{5,}$/.test(imdbId)) {
    res.status(400).json({ status: 'error', videoId: null, message: 'Trailer unavailable. Invalid IMDb id.' })
    return
  }

  if (!youtubeConfigured()) {
    const stale = getStaleAvailableTrailer(imdbId)
    if (stale) {
      res.json({
        status: 'available',
        videoId: stale.videoId,
        message: null,
        fromStaleCache: true,
        title: null,
        year: null,
        channelTitle: stale.channelTitle ?? null,
      })
      return
    }
    res.status(503).json({
      status: 'not_configured',
      videoId: null,
      message: `Trailer unavailable. YOUTUBE_API_KEY is not configured on the server. ${YOUTUBE_KEY_SETUP_HINT}`,
      hint: YOUTUBE_KEY_SETUP_HINT,
      envFilesPresent: getServerConfigDiagnostic().envFilesPresent,
    })
    return
  }

  try {
    const movie = await movieForImdb(imdbId)
    if (!movie) {
      res.status(404).json({
        status: 'unavailable',
        videoId: null,
        message: 'Trailer unavailable. Movie not found in OMDb.',
      })
      return
    }

    const resolved = await resolveTrailerForMovie(imdbId, movie.title, movie.releaseYear)
    res.json({
      status: resolved.status,
      videoId: resolved.videoId,
      title: movie.title,
      year: movie.releaseYear,
      channelTitle: resolved.channelTitle ?? null,
      message:
        resolved.status === 'unavailable'
          ? (resolved.message ?? 'Trailer unavailable. No matching trailer found.')
          : null,
      fromStaleCache: resolved.fromStaleCache ?? false,
    })
  } catch (err) {
    if (err instanceof TrailerApiError) {
      const stale = getStaleAvailableTrailer(imdbId)
      if (stale) {
        res.json({
          status: 'available',
          videoId: stale.videoId,
          title: null,
          year: null,
          channelTitle: stale.channelTitle ?? null,
          message: null,
          fromStaleCache: true,
        })
        return
      }
      const body = apiErrorResponse(err)
      const status = err.code === 'quota_exceeded' || err.code === 'invalid_key' ? 503 : 502
      res.status(status).json(body)
      return
    }
    res.status(502).json({
      status: 'error',
      videoId: null,
      message: 'Trailer unavailable. Lookup failed.',
    })
  }
}

export async function trailerReportEmbedFailure(req: Request, res: Response) {
  const imdbId = typeof req.body?.imdbId === 'string' ? req.body.imdbId.trim() : ''
  const videoId = typeof req.body?.videoId === 'string' ? req.body.videoId.trim() : ''
  if (!/^tt\d{5,}$/.test(imdbId) || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
    res.status(400).json({ ok: false })
    return
  }
  invalidateCachedTrailer(imdbId, videoId)
  res.json({ ok: true })
}
