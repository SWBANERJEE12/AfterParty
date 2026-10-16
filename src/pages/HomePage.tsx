import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { WatchTrailerButton } from '../components/movie/WatchTrailerButton'
import { TrailerModal } from '../components/movie/TrailerModal'
import { useTrailerModal } from '../hooks/useTrailerModal'
import { fetchOmdbRow, fetchOmdbStatus, fetchTrailerStatus } from '../lib/api'
import type { MovieMeta } from '../shared/movies'

function PosterCard({
  movie,
  onWatchTrailer,
  trailerLoading,
  trailersConfigured,
}: {
  movie: MovieMeta
  onWatchTrailer: (m: MovieMeta) => void
  trailerLoading: boolean
  trailersConfigured: boolean | null
}) {
  const poster = movie.posterUrl ?? 'https://via.placeholder.com/342x513/152331/fe4401?text=No+Poster'
  return (
    <div className="group w-36 shrink-0 snap-start">
      <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)]">
        <Link to="/discover" className="block">
          <img src={poster} alt="" className="aspect-[2/3] w-full object-cover" />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-8 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="pointer-events-auto flex justify-center">
            <WatchTrailerButton
              movie={movie}
              size="sm"
              loading={trailerLoading}
              trailersConfigured={trailersConfigured}
              onWatch={onWatchTrailer}
              className="w-full max-w-[9.5rem]"
            />
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium">{movie.title}</p>
    </div>
  )
}

export function HomePage() {
  const { profile } = useAuth()
  const [featured, setFeatured] = useState<MovieMeta | null>(null)
  const [row, setRow] = useState<MovieMeta[]>([])
  const [omdbOk, setOmdbOk] = useState<boolean | null>(null)
  const [trailersConfigured, setTrailersConfigured] = useState<boolean | null>(null)
  const trailer = useTrailerModal()

  useEffect(() => {
    fetchOmdbStatus().then((s) => setOmdbOk(s.configured))
    fetchTrailerStatus().then((s) => setTrailersConfigured(s.configured))
  }, [])

  useEffect(() => {
    if (!omdbOk) return
    fetchOmdbRow('popular').then((res) => {
      setRow(res.movies)
      if (res.movies[0]) setFeatured(res.movies[0])
    })
  }, [omdbOk])

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="glass-panel rounded-2xl p-6 md:p-8">
        <p className="text-sm text-[var(--color-muted)]">Welcome back{profile ? `, ${profile.display_name}` : ''}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-fg)]">Tonight&apos;s watch party starts here</h1>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/party/create" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
            Create room
          </Link>
          <Link to="/party/join" className="glass-panel rounded-lg px-4 py-2 text-sm font-semibold">
            Join room
          </Link>
          <Link to="/discover" className="glass-panel rounded-lg px-4 py-2 text-sm font-semibold">
            Discover movies
          </Link>
        </div>
      </section>

      {featured && (
        <section className="glass-panel overflow-hidden rounded-2xl md:flex">
          <img
            src={featured.posterUrl ?? 'https://via.placeholder.com/400x600/152331/fe4401?text=Featured'}
            alt=""
            className="h-64 w-full object-cover md:h-auto md:w-64"
          />
          <div className="p-6">
            <p className="text-xs uppercase tracking-widest text-[var(--color-accent)]">Featured</p>
            <h2 className="mt-2 text-2xl font-semibold">{featured.title}</h2>
            <p className="mt-2 line-clamp-4 text-sm text-[var(--color-muted)]">{featured.overview}</p>
            <div className="mt-4">
              <WatchTrailerButton
                movie={featured}
                loading={trailer.isLoadingMovie(featured)}
                trailersConfigured={trailersConfigured}
                onWatch={(m) => void trailer.playTrailer(m)}
              />
            </div>
          </div>
        </section>
      )}

      {omdbOk === false && (
        <p className="text-sm text-amber-200/90">
          Movie metadata requires <code>OMDB_API_KEY</code> on the Express server. Run <code>npm run dev</code>.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Popular searches</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {row.map((m) => (
            <PosterCard
              key={m.imdbId ?? m.id}
              movie={m}
              onWatchTrailer={(x) => void trailer.playTrailer(x)}
              trailerLoading={trailer.isLoadingMovie(m)}
              trailersConfigured={trailersConfigured}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link to="/history" className="glass-panel rounded-xl p-4 hover:border-[var(--color-accent)]/40">
          <h3 className="font-medium">Continue watching</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Resume titles you&apos;ve started (requires sign-in + history).</p>
        </Link>
        <Link to="/my-list" className="glass-panel rounded-xl p-4 hover:border-[var(--color-accent)]/40">
          <h3 className="font-medium">My List</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Saved movies from discovery.</p>
        </Link>
      </section>

      <TrailerModal
        open={trailer.open}
        title={trailer.display.title}
        year={trailer.display.year}
        videoId={trailer.videoId}
        loading={trailer.loading}
        error={trailer.error}
        unavailableMessage={trailer.unavailableMessage}
        onClose={trailer.close}
        onEmbedFailure={trailer.onEmbedFailure}
      />
    </div>
  )
}
