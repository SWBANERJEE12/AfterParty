import assert from 'node:assert/strict'
import {
  hasUsablePoster,
  pickRecommendedMovies,
} from '../src/lib/discoverRecommendations.ts'
import type { MovieMeta } from '../src/shared/movies.ts'

function movie(partial: Partial<MovieMeta> & { id: number; title: string }): MovieMeta {
  return {
    overview: '',
    releaseYear: '2020',
    trailerYoutubeKey: null,
    posterUrl: 'https://example.com/poster.jpg',
    ...partial,
  }
}

const rows = {
  popular: [
    movie({ id: 1, title: 'A', imdbId: 'tt1', imdbRating: '8.0' }),
    movie({ id: 2, title: 'B', imdbId: 'tt2', imdbRating: '7.0' }),
  ],
  action: [movie({ id: 3, title: 'C', imdbId: 'tt3', imdbRating: '9.0' })],
}

assert.equal(hasUsablePoster(movie({ id: 9, title: 'X', posterUrl: null })), false)
const picked = pickRecommendedMovies(rows, ['popular', 'action'], 10)
assert.equal(picked.length, 3)
assert.equal(new Set(picked.map((m) => m.imdbId)).size, 3)
assert.ok(picked.some((m) => m.imdbId === 'tt3'))

console.log('All discover recommendation unit tests passed.')
