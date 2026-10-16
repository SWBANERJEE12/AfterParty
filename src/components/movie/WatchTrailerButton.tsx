import type { MovieMeta } from '../../shared/movies'

type Props = {
  movie: MovieMeta
  loading?: boolean
  disabled?: boolean
  trailersConfigured?: boolean | null
  onWatch: (movie: MovieMeta) => void
  className?: string
  size?: 'sm' | 'md'
}

export function WatchTrailerButton({
  movie,
  loading = false,
  disabled = false,
  trailersConfigured = null,
  onWatch,
  className = '',
  size = 'md',
}: Props) {
  const noImdb = !movie.imdbId
  const off = disabled || loading || noImdb

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-1 text-[10px] gap-1'
      : 'px-3 py-1.5 text-xs gap-1.5'

  return (
    <button
      type="button"
      disabled={off}
      onClick={(e) => {
        e.stopPropagation()
        onWatch(movie)
      }}
      className={`inline-flex items-center justify-center rounded-md font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} bg-[#FE4401] hover:brightness-110 ${className}`}
      title={
        trailersConfigured === false
          ? 'Trailers may be unavailable until YOUTUBE_API_KEY is set on the server'
          : undefined
      }
      aria-label={loading ? 'Loading trailer' : `Watch trailer for ${movie.title}`}
    >
      <span aria-hidden>{loading ? '…' : '▶'}</span>
      <span>{loading ? 'Loading…' : 'Watch Trailer'}</span>
    </button>
  )
}
