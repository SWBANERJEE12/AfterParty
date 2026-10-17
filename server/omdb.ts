import type { MovieMeta } from '../src/shared/movies.js'
import { CATALOG_IMDB_IDS } from './movieCatalog.js'

const OMDB_BASE = 'https://www.omdbapi.com/'

export type ShelfMovie = {
  imdbId: string
  title: string
  posterUrl: string
}

const SHELF_SEARCH_TERMS = ['action', 'comedy', 'drama', 'horror', 'adventure', 'marvel']
const SHELF_IMDB_SEED = [
  'tt3896198',
  'tt0111161',
  'tt0068646',
  'tt0468569',
  'tt1375666',
  'tt0816692',
  'tt4154756',
  'tt0848228',
  'tt1856101',
  'tt0120737',
  'tt0167260',
  'tt0088763',
  'tt0109830',
  'tt0137523',
  'tt0110912',
]

type OmdbSearchResponse = {
  Response: string
  Search?: { imdbID: string; Title: string; Poster: string; Year: string }[]
}

type OmdbDetailResponse = {
  Response: string
  imdbID?: string
  Title?: string
  Type?: string
  Poster?: string
  Year?: string
  Plot?: string
  imdbRating?: string
  Genre?: string
  Director?: string
  Actors?: string
}

export function omdbConfigured(): boolean {
  return Boolean(process.env.OMDB_API_KEY?.trim())
}

function apiKey(): string {
  const key = process.env.OMDB_API_KEY?.trim()
  if (!key) throw new Error('OMDB_API_KEY missing')
  return key
}

export function imdbNumericId(imdbId: string): number {
  let h = 0
  for (let i = 0; i < imdbId.length; i++) {
    h = Math.imul(31, h) + imdbId.charCodeAt(i)
  }
  return Math.abs(h) || 1
}

function validPoster(poster: string | undefined): string | null {
  if (!poster || poster === 'N/A') return null
  return poster
}

async function omdbFetch<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(OMDB_BASE)
  url.searchParams.set('apikey', apiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchByImdbId(imdbId: string): Promise<MovieMeta | null> {
  if (!omdbConfigured()) return null
  const data = await omdbFetch<OmdbDetailResponse>({ i: imdbId })
  if (!data || data.Response !== 'True' || !data.imdbID) return null
  const posterUrl = validPoster(data.Poster)
  return {
    id: imdbNumericId(data.imdbID),
    imdbId: data.imdbID,
    title: data.Title ?? 'Untitled',
    overview: data.Plot?.slice(0, 500) || 'No description available.',
    posterUrl,
    releaseYear: data.Year ?? '—',
    genre: data.Genre,
    director: data.Director,
    actors: data.Actors,
    imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
    mediaType: data.Type === 'series' ? 'series' : 'movie',
    trailerYoutubeKey: null,
  }
}

export async function searchMoviesOmdb(query: string): Promise<MovieMeta[]> {
  if (!omdbConfigured()) return []
  const q = query.trim()
  if (!q) {
    const seeded: MovieMeta[] = []
    for (const id of CATALOG_IMDB_IDS.slice(0, 24)) {
      const m = await fetchByImdbId(id)
      if (m) seeded.push(m)
    }
    return seeded
  }

  const data = await omdbFetch<OmdbSearchResponse>({ s: q, type: 'movie' })
  if (!data?.Search?.length) return []

  const movies: MovieMeta[] = []
  for (const hit of data.Search.slice(0, 12)) {
    const posterUrl = validPoster(hit.Poster)
    let detail = await fetchByImdbId(hit.imdbID)
    if (!detail) {
      detail = {
        id: imdbNumericId(hit.imdbID),
        imdbId: hit.imdbID,
        title: hit.Title,
        overview: 'No description available.',
        posterUrl,
        releaseYear: hit.Year ?? '—',
        trailerYoutubeKey: null,
      }
    } else if (!detail.posterUrl && posterUrl) {
      detail.posterUrl = posterUrl
    }
    movies.push(detail)
  }
  return movies
}

export async function getBlockbusterShelfMovies(): Promise<ShelfMovie[]> {
  const map = new Map<string, ShelfMovie>()

  if (omdbConfigured()) {
    for (const id of SHELF_IMDB_SEED) {
      const detail = await fetchByImdbId(id)
      if (detail?.posterUrl && detail.imdbId) {
        map.set(detail.imdbId, {
          imdbId: detail.imdbId,
          title: detail.title,
          posterUrl: detail.posterUrl,
        })
      }
    }

    for (const term of SHELF_SEARCH_TERMS) {
      const data = await omdbFetch<OmdbSearchResponse>({ s: term, type: 'movie' })
      for (const hit of data?.Search ?? []) {
        const posterUrl = validPoster(hit.Poster)
        if (!posterUrl) continue
        map.set(hit.imdbID, {
          imdbId: hit.imdbID,
          title: hit.Title,
          posterUrl,
        })
      }
    }
  }

  if (map.size === 0) {
    return SHELF_IMDB_SEED.map((id, i) => ({
      imdbId: id,
      title: `Classic Pick ${i + 1}`,
      posterUrl: `https://via.placeholder.com/342x513/1e4d8c/f5d442?text=Rent`,
    }))
  }

  return [...map.values()].slice(0, 48)
}
