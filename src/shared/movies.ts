export type MovieMeta = {
  id: number
  imdbId?: string
  title: string
  overview: string
  posterUrl: string | null
  releaseYear: string
  genre?: string
  director?: string
  actors?: string
  imdbRating?: string
  mediaType?: 'movie' | 'series'
  trailerYoutubeKey: string | null
}

export type ShelfMovie = {
  imdbId: string
  title: string
  posterUrl: string
}

export type VoteState = {
  shortlist: MovieMeta[]
  votes: Record<string, string[]>
  winnerId: number | null
}

export const EMPTY_VOTE_STATE: VoteState = {
  shortlist: [],
  votes: {},
  winnerId: null,
}
