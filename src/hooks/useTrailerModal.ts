import { useCallback, useRef, useState } from 'react'
import { fetchMovieTrailer, reportTrailerEmbedFailure } from '../lib/api'
import { TRAILER_UNAVAILABLE, trailerUserMessage } from '../lib/trailerMessages'
import type { MovieMeta } from '../shared/movies'

export function useTrailerModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMovieId, setLoadingMovieId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)
  const [display, setDisplay] = useState<{ title: string; year: string }>({ title: '', year: '' })
  const [activeMovie, setActiveMovie] = useState<MovieMeta | null>(null)
  const activeImdbId = useRef<string | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setVideoId(null)
    setError(null)
    setUnavailableMessage(null)
    setLoading(false)
    setLoadingMovieId(null)
    activeImdbId.current = null
    setActiveMovie(null)
  }, [])

  const playTrailer = useCallback(async (movie: MovieMeta) => {
    if (!movie.imdbId) {
      setDisplay({ title: movie.title, year: movie.releaseYear })
      setActiveMovie(movie)
      setOpen(true)
      setError(trailerUserMessage('This title has no IMDb id.'))
      return
    }

    setDisplay({ title: movie.title, year: movie.releaseYear })
    setActiveMovie(movie)
    setOpen(true)
    setLoading(true)
    setLoadingMovieId(movie.imdbId)
    activeImdbId.current = movie.imdbId
    setVideoId(null)
    setError(null)
    setUnavailableMessage(null)

    try {
      const res = await fetchMovieTrailer(movie.imdbId)

      if (res.status === 'not_configured') {
        setError(trailerUserMessage(res.message))
        return
      }
      if (res.status === 'error') {
        setError(trailerUserMessage(res.message))
        return
      }
      if (res.status === 'unavailable' || !res.videoId) {
        setUnavailableMessage(trailerUserMessage(res.message ?? 'No matching trailer found.'))
        return
      }

      setDisplay({
        title: res.title ?? movie.title,
        year: res.year ?? movie.releaseYear,
      })
      setVideoId(res.videoId)
    } catch {
      setError(trailerUserMessage('Unexpected error.'))
    } finally {
      setLoading(false)
      setLoadingMovieId(null)
    }
  }, [])

  const onEmbedFailure = useCallback(() => {
    const imdbId = activeImdbId.current
    if (imdbId && videoId) {
      void reportTrailerEmbedFailure(imdbId, videoId)
    }
    setVideoId(null)
    setUnavailableMessage(
      trailerUserMessage('This video is private, removed, or cannot be embedded.'),
    )
  }, [videoId])

  const isLoadingMovie = useCallback(
    (movie: MovieMeta) => Boolean(loading && movie.imdbId && loadingMovieId === movie.imdbId),
    [loading, loadingMovieId],
  )

  return {
    open,
    loading,
    videoId,
    error,
    unavailableMessage,
    display,
    playTrailer,
    close,
    isLoadingMovie,
    onEmbedFailure,
    unavailableHeading: TRAILER_UNAVAILABLE,
    activeMovie,
  }
}
