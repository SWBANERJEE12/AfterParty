import type { MovieMeta } from '../shared/movies'

const PLACEHOLDER_HOST = 'via.placeholder.com'

export function hasUsablePoster(movie: MovieMeta): boolean {
  const url = movie.posterUrl?.trim()
  if (!url) return false
  if (url.includes(PLACEHOLDER_HOST)) return false
  return /^https?:\/\//i.test(url)
}

function ratingValue(movie: MovieMeta): number {
  const n = Number.parseFloat(movie.imdbRating ?? '')
  return Number.isFinite(n) ? n : 0
}

/**
 * Build a diverse recommended set from catalogue rows already loaded on Discover.
 * No extra API calls; does not invent scores.
 */
export function pickRecommendedMovies(
  rows: Record<string, MovieMeta[]>,
  rowOrder: readonly string[],
  limit = 12,
): MovieMeta[] {
  const seen = new Set<string>()
  const out: MovieMeta[] = []

  const push = (movie: MovieMeta) => {
    const key = movie.imdbId ?? `id:${movie.id}`
    if (seen.has(key)) return
    if (!hasUsablePoster(movie)) return
    seen.add(key)
    out.push(movie)
  }

  for (const rowId of rowOrder) {
    const row = rows[rowId] ?? []
    const candidates = row.filter(hasUsablePoster).sort((a, b) => ratingValue(b) - ratingValue(a))
    if (candidates[0]) push(candidates[0])
    if (out.length >= limit) return out.slice(0, limit)
  }

  const rest: MovieMeta[] = []
  for (const rowId of rowOrder) {
    for (const movie of rows[rowId] ?? []) {
      const key = movie.imdbId ?? `id:${movie.id}`
      if (seen.has(key) || !hasUsablePoster(movie)) continue
      rest.push(movie)
    }
  }
  rest.sort((a, b) => ratingValue(b) - ratingValue(a))
  for (const movie of rest) {
    push(movie)
    if (out.length >= limit) break
  }

  return out.slice(0, limit)
}

export function movieToCarouselItem(movie: MovieMeta) {
  const subtitle = [movie.releaseYear, movie.genre?.split(',')[0]?.trim()]
    .filter(Boolean)
    .join(' · ')
  return {
    src: movie.posterUrl!,
    alt: `${movie.title} poster`,
    title: movie.title,
    subtitle: subtitle || undefined,
  }
}
