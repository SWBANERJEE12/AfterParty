import type { Request, Response } from 'express'
import { CATALOG_IMDB_IDS } from './movieCatalog'
import { fetchByImdbId, omdbConfigured, searchMoviesOmdb } from './omdb'

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; data: unknown }>()

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data as T)
  return loader().then((data) => {
    cache.set(key, { at: Date.now(), data })
    return data
  })
}

export const DISCOVER_ROWS: Record<string, string[]> = {
  popular: ['tt0111161', 'tt0068646', 'tt0468569', 'tt1375666', 'tt0816692', 'tt4154756'],
  action: ['tt3896198', 'tt0848228', 'tt2911666', 'tt0371746', 'tt0379789', 'tt1431045'],
  comedy: ['tt0109830', 'tt0110912', 'tt0102926', 'tt0386676', 'tt1431045', 'tt0317705'],
  thriller: ['tt1130884', 'tt0482571', 'tt0993846', 'tt0407887', 'tt0361748', 'tt2381249'],
  scifi: ['tt0816692', 'tt1375666', 'tt1856101', 'tt0088763', 'tt0120737', 'tt0167260'],
  recent: CATALOG_IMDB_IDS.slice(0, 12),
}

export function omdbStatus(_req: Request, res: Response) {
  res.json({ configured: omdbConfigured() })
}

export async function omdbSearch(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  if (!omdbConfigured()) {
    res.status(503).json({ error: 'OMDB_API_KEY is not configured on the server.', results: [] })
    return
  }
  try {
    const results = await cached(`search:${q}`, () => searchMoviesOmdb(q))
    res.json({ results })
  } catch {
    res.status(502).json({ error: 'OMDB request failed.', results: [] })
  }
}

export async function omdbTitle(req: Request, res: Response) {
  const imdbId = typeof req.params.imdbId === 'string' ? req.params.imdbId.trim() : ''
  if (!/^tt\d+$/.test(imdbId)) {
    res.status(400).json({ error: 'Invalid IMDb id.' })
    return
  }
  if (!omdbConfigured()) {
    res.status(503).json({ error: 'OMDB_API_KEY is not configured on the server.' })
    return
  }
  try {
    const movie = await cached(`title:${imdbId}`, () => fetchByImdbId(imdbId))
    if (!movie) {
      res.status(404).json({ error: 'Title not found.' })
      return
    }
    res.json({ movie })
  } catch {
    res.status(502).json({ error: 'OMDB request failed.' })
  }
}

export async function omdbRow(req: Request, res: Response) {
  const rowId = typeof req.params.rowId === 'string' ? req.params.rowId : 'popular'
  const ids = DISCOVER_ROWS[rowId] ?? DISCOVER_ROWS.popular
  if (!omdbConfigured()) {
    res.status(503).json({ error: 'OMDB_API_KEY is not configured.', movies: [] })
    return
  }
  try {
    const movies = []
    for (const id of ids) {
      const m = await cached(`title:${id}`, () => fetchByImdbId(id))
      if (m) movies.push(m)
    }
    res.json({ rowId, movies })
  } catch {
    res.status(502).json({ error: 'OMDB request failed.', movies: [] })
  }
}
