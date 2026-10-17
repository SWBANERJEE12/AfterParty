import { fetchMovieTrailer } from './api'
import { getSupabase, isSupabaseConfigured } from './supabase'
import type { MovieMeta } from '../shared/movies'

export async function proposeMovieToRoom(
  roomId: string,
  memberKey: string,
  nickname: string,
  movie: MovieMeta,
  youtubeVideoId?: string | null,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!movie.imdbId) return { ok: false, error: 'This title has no IMDb id.' }
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase required to save room proposals.' }
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' }

  const nick = nickname.trim()
  if (!nick || nick === 'Guest') {
    return { ok: false, error: 'Set your nickname on Create/Join watch party before proposing.' }
  }

  let trailerVideoId = youtubeVideoId ?? null
  if (!trailerVideoId) {
    try {
      const trailer = await fetchMovieTrailer(movie.imdbId)
      trailerVideoId = trailer.videoId
    } catch {
      trailerVideoId = null
    }
  }

  const { error: proposeErr } = await supabase.rpc('propose_room_movie', {
    p_room_id: roomId,
    p_member_key: memberKey,
    p_nickname: nick,
    p_imdb_id: movie.imdbId,
    p_title: movie.title,
    p_poster_url: movie.posterUrl,
    p_release_year: movie.releaseYear,
  })
  if (proposeErr) return { ok: false, error: proposeErr.message }

  const { data: poll, error: pollErr } = await supabase.rpc('start_room_vote_poll', {
    p_room_id: roomId,
    p_member_key: memberKey,
    p_nickname: nick,
    p_imdb_id: movie.imdbId,
    p_title: movie.title,
    p_poster_url: movie.posterUrl,
    p_release_year: movie.releaseYear,
    p_youtube_video_id: trailerVideoId,
    p_duration_sec: 30,
  })
  if (pollErr) {
    return {
      ok: true,
      message: `“${movie.title}” added to the room shortlist. Vote poll did not start: ${pollErr.message}`,
    }
  }
  if (poll) return { ok: true, message: 'Proposed — room vote started (30s).' }
  return { ok: true, message: `“${movie.title}” proposed to your room.` }
}
