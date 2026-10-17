import type { MovieMeta } from '../src/shared/movies.js'
import { omdbConfigured, searchMoviesOmdb } from './omdb.js'

const FALLBACK_MOVIES: MovieMeta[] = [
  {
    id: 1001,
    title: 'Midnight Pizza Run',
    overview: 'Four friends race across town before the last slice shop closes.',
    posterUrl: null,
    releaseYear: '2019',
    trailerYoutubeKey: null,
  },
  {
    id: 1002,
    title: 'Neon Harbor',
    overview: 'A cozy sci-fi mystery set on a floating city at dusk.',
    posterUrl: null,
    releaseYear: '2021',
    trailerYoutubeKey: null,
  },
  {
    id: 1003,
    title: 'The Last Blockbuster',
    overview: 'Documentary vibes: one store, infinite nostalgia.',
    posterUrl: null,
    releaseYear: '2020',
    trailerYoutubeKey: null,
  },
  {
    id: 1004,
    title: 'Sofa Kingdom',
    overview: 'Animated adventure where cushions hold ancient secrets.',
    posterUrl: null,
    releaseYear: '2018',
    trailerYoutubeKey: null,
  },
  {
    id: 1005,
    title: 'Rain on Route 9',
    overview: 'Road-trip drama with a killer synth soundtrack.',
    posterUrl: null,
    releaseYear: '2022',
    trailerYoutubeKey: null,
  },
]

type TmdbSearchItem = {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
}

function posterUrl(path: string | null): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/w342${path}`
}

function yearFrom(item: TmdbSearchItem): string {
  const d = item.release_date ?? item.first_air_date ?? ''
  return d.slice(0, 4) || '—'
}

export async function searchMovies(query: string): Promise<MovieMeta[]> {
  const q = query.trim()

  if (omdbConfigured()) {
    const omdbResults = await searchMoviesOmdb(q)
    if (omdbResults.length) return omdbResults
  }

  if (!q) return FALLBACK_MOVIES.slice(0, 8)

  const key = process.env.TMDB_API_KEY
  if (!key) {
    const lower = q.toLowerCase()
    return FALLBACK_MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(lower) ||
        m.overview.toLowerCase().includes(lower),
    ).slice(0, 12)
  }

  const url = new URL('https://api.themoviedb.org/3/search/multi')
  url.searchParams.set('api_key', key)
  url.searchParams.set('query', q)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')

  const res = await fetch(url)
  if (!res.ok) {
    return FALLBACK_MOVIES.slice(0, 6)
  }

  const data = (await res.json()) as { results?: TmdbSearchItem[] }
  const results = (data.results ?? []).filter(
    (r) => r.poster_path && (r.title || r.name),
  )

  const movies: MovieMeta[] = []
  for (const item of results.slice(0, 12)) {
    const videos = await fetchTrailerKey(key, item.id)
    movies.push({
      id: item.id,
      title: item.title ?? item.name ?? 'Untitled',
      overview: item.overview?.slice(0, 280) || 'No description available.',
      posterUrl: posterUrl(item.poster_path),
      releaseYear: yearFrom(item),
      trailerYoutubeKey: videos,
    })
  }

  return movies.length ? movies : FALLBACK_MOVIES.slice(0, 6)
}

async function fetchTrailerKey(apiKey: string, movieId: number): Promise<string | null> {
  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${movieId}/videos`)
    url.searchParams.set('api_key', apiKey)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: { site: string; type: string; key: string }[]
    }
    const yt = data.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
    return yt?.key ?? null
  } catch {
    return null
  }
}
