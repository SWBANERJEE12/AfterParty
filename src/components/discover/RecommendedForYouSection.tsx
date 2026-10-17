import { useCallback, useEffect, useMemo, useState } from 'react'
import FlexCarousel from './FlexCarousel'
import { movieToCarouselItem } from '../../lib/discoverRecommendations'
import type { MovieMeta } from '../../shared/movies'
import { WatchTrailerButton } from '../movie/WatchTrailerButton'

type Props = {
  movies: MovieMeta[]
  loading: boolean
  omdbOk: boolean | null
  selected: MovieMeta | null
  onSelectedChange: (movie: MovieMeta) => void
  onOpenDetails: (movie: MovieMeta) => void
  onWatchTrailer: (movie: MovieMeta) => void
  onPropose: (movie: MovieMeta) => void
  roomActive: boolean
  proposeBusy?: boolean
  trailersConfigured: boolean | null
  trailerLoading: boolean
  onRetryLoad?: () => void
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}

function useWebGL2Available() {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      setOk(!!canvas.getContext('webgl2'))
    } catch {
      setOk(false)
    }
  }, [])
  return ok
}

function PosterFallback({
  movies,
  selected,
  onSelect,
}: {
  movies: MovieMeta[]
  selected: MovieMeta | null
  onSelect: (m: MovieMeta, index: number) => void
}) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
      role="list"
      aria-label="Recommended movies"
    >
      {movies.map((movie, index) => (
        <button
          key={movie.imdbId ?? movie.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(movie, index)}
          className={`w-28 shrink-0 snap-center overflow-hidden rounded-lg border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            selected?.imdbId === movie.imdbId
              ? 'border-[var(--color-accent)]'
              : 'border-[var(--color-border)]'
          }`}
        >
          <img
            src={movie.posterUrl!}
            alt={`${movie.title} poster`}
            className="aspect-[2/3] w-full object-cover"
            loading="lazy"
          />
          <p className="truncate px-1 py-1 text-[10px] font-medium text-[var(--color-fg)]">{movie.title}</p>
        </button>
      ))}
    </div>
  )
}

export function RecommendedForYouSection({
  movies,
  loading,
  omdbOk,
  selected,
  onSelectedChange,
  onOpenDetails,
  onWatchTrailer,
  onPropose,
  roomActive,
  proposeBusy = false,
  trailersConfigured,
  trailerLoading,
  onRetryLoad,
}: Props) {
  const reducedMotion = usePrefersReducedMotion()
  const webglOk = useWebGL2Available()
  const [webglFailed, setWebglFailed] = useState(false)
  const useWebGL = webglOk && !webglFailed

  const items = useMemo(() => movies.map(movieToCarouselItem), [movies])

  const handleChange = useCallback(
    (index: number) => {
      const movie = movies[index]
      if (movie) onSelectedChange(movie)
    },
    [movies, onSelectedChange],
  )

  const handleSelect = useCallback(
    (_index: number, item: { title?: string }) => {
      const movie = movies.find((m) => m.title === item.title) ?? movies[_index]
      if (movie) void onOpenDetails(movie)
    },
    [movies, onOpenDetails],
  )

  const focusMovie = selected ?? movies[0] ?? null

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 md:px-0" aria-labelledby="recommended-heading">
      <div className="mb-4">
        <h2 id="recommended-heading" className="text-xl font-semibold text-[var(--color-fg)] md:text-2xl">
          Recommended for You
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Your next movie night starts here.</p>
      </div>

      {loading && (
        <div
          className="flex h-[min(52vh,420px)] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40"
          aria-busy="true"
        >
          <span className="text-sm text-[var(--color-muted)]">Loading recommendations…</span>
        </div>
      )}

      {!loading && omdbOk === false && (
        <p className="text-sm text-amber-100/90">Configure OMDB on the server to browse recommendations.</p>
      )}

      {!loading && omdbOk && movies.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">No posters available for recommendations yet.</p>
          {onRetryLoad && (
            <button
              type="button"
              className="mt-3 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
              onClick={onRetryLoad}
            >
              Reload catalogue
            </button>
          )}
        </div>
      )}

      {!loading && movies.length > 0 && (
        <>
          <div
            className="relative h-[min(52vh,440px)] min-h-[280px] w-full overflow-visible rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)]/30 md:h-[min(56vh,480px)]"
          >
            {useWebGL ? (
              <FlexCarousel
                items={items}
                preset="liquid"
                intro={reducedMotion ? 'fade' : 'rise'}
                cardHeight={0.46}
                gap={14}
                radius={12}
                fit="portrait"
                squeeze={0.18}
                focusOnClick={false}
                autoplay={!reducedMotion}
                interval={5}
                captions
                captureWheel={false}
                ariaLabel="Recommended for you movie carousel"
                onChange={handleChange}
                onSelect={handleSelect}
                onWebGLUnavailable={() => setWebglFailed(true)}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col justify-center p-4">
                <p className="mb-3 text-center text-xs text-[var(--color-muted)]">
                  WebGL2 unavailable — showing a simplified carousel.
                </p>
                <PosterFallback
                  movies={movies}
                  selected={focusMovie}
                  onSelect={(m) => onSelectedChange(m)}
                />
              </div>
            )}
          </div>

          {focusMovie && (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 md:flex-row md:items-start">
              <img
                src={focusMovie.posterUrl!}
                alt={`${focusMovie.title} poster`}
                className="mx-auto h-40 w-28 rounded-lg object-cover md:mx-0"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-[var(--color-fg)]">{focusMovie.title}</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {focusMovie.releaseYear}
                  {focusMovie.imdbRating ? ` · IMDb ${focusMovie.imdbRating}` : ''}
                  {focusMovie.genre ? ` · ${focusMovie.genre}` : ''}
                </p>
                {focusMovie.overview && (
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--color-muted)]">{focusMovie.overview}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <WatchTrailerButton
                    movie={focusMovie}
                    loading={trailerLoading}
                    trailersConfigured={trailersConfigured}
                    onWatch={onWatchTrailer}
                  />
                  <button
                    type="button"
                    onClick={() => void onOpenDetails(focusMovie)}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)]"
                  >
                    More details
                  </button>
                  <button
                    type="button"
                    disabled={!roomActive || proposeBusy}
                    title={roomActive ? 'Propose to your watch room' : 'Join a watch room to propose'}
                    onClick={() => onPropose(focusMovie)}
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {proposeBusy ? 'Proposing…' : 'Propose to room'}
                  </button>
                </div>
                {!roomActive && (
                  <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                    Create or join a watch room to propose this title to everyone.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
