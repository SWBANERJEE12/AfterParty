import { useEffect, useState } from 'react'
import type { ShelfMovie } from '../../shared/movies'

export function useShelfMovies() {
  const [movies, setMovies] = useState<ShelfMovie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/movies/shelf')
      .then((r) => r.json())
      .then((data: { movies: ShelfMovie[] }) => {
        if (!cancelled) setMovies(data.movies ?? [])
      })
      .catch(() => {
        if (!cancelled) setMovies([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { movies, loading }
}
