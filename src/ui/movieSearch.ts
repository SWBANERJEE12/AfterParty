import Fuse from 'fuse.js'
import type { MovieMeta } from '../shared/movies'

export function rankMovies(query: string, movies: MovieMeta[]): MovieMeta[] {
  const q = query.trim()
  if (!q || q.length < 2) return movies
  const fuse = new Fuse(movies, {
    keys: [
      { name: 'title', weight: 0.55 },
      { name: 'genre', weight: 0.15 },
      { name: 'director', weight: 0.15 },
      { name: 'releaseYear', weight: 0.1 },
      { name: 'overview', weight: 0.05 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
  })
  return fuse.search(q).map((r) => r.item)
}
