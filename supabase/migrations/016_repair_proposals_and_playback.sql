-- Repair: ensures room_movie_proposals + playback RPCs exist (safe if 005/015 already applied).
-- Apply in Supabase SQL Editor when you see schema-cache errors for proposals or get_room_playback_state.

-- ---------------------------------------------------------------------------
-- room_movie_proposals (from 005, plus authenticated RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.room_movie_proposals (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  imdb_id text not null,
  title text not null,
  poster_url text,
  release_year text,
  member_key uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  created_at timestamptz not null default now(),
  unique (room_id, imdb_id)
);

create index if not exists room_movie_proposals_room_idx
  on public.room_movie_proposals (room_id, created_at desc);

alter table public.room_movie_proposals enable row level security;

drop policy if exists "room_movie_proposals_select_member" on public.room_movie_proposals;
drop policy if exists "room_movie_proposals_insert_member" on public.room_movie_proposals;
drop policy if exists "room_movie_proposals_select_authenticated" on public.room_movie_proposals;
drop policy if exists "room_movie_proposals_insert_authenticated" on public.room_movie_proposals;

create policy "room_movie_proposals_select_member"
  on public.room_movie_proposals for select
  to anon
  using (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_movie_proposals.room_id
    )
  );

create policy "room_movie_proposals_insert_member"
  on public.room_movie_proposals for insert
  to anon
  with check (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_movie_proposals.room_id
        and rm.member_key = room_movie_proposals.member_key
    )
  );

create policy "room_movie_proposals_select_authenticated"
  on public.room_movie_proposals for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_movie_proposals.room_id
    )
  );

create policy "room_movie_proposals_insert_authenticated"
  on public.room_movie_proposals for insert
  to authenticated
  with check (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_movie_proposals.room_id
        and rm.member_key = room_movie_proposals.member_key
    )
  );

-- Member-validated fetch (p_member_key text — matches JS UUID strings / PostgREST)
drop function if exists public.fetch_room_proposals(text, uuid);

create or replace function public.fetch_room_proposals(
  p_room_id text,
  p_member_key text
)
returns setof public.room_movie_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
begin
  begin
    v_member_key := trim(p_member_key)::uuid;
  exception when others then
    raise exception 'invalid member_key' using errcode = '22023';
  end;

  if not exists (
    select 1 from public.room_members as rm
    where rm.room_id = p_room_id and rm.member_key = v_member_key
  ) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  return query
  select p.*
  from public.room_movie_proposals as p
  where p.room_id = p_room_id
  order by p.created_at desc
  limit 20;
end;
$$;

create or replace function public.propose_room_movie(
  p_room_id text,
  p_member_key text,
  p_nickname text,
  p_imdb_id text,
  p_title text,
  p_poster_url text default null,
  p_release_year text default null
)
returns public.room_movie_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_row public.room_movie_proposals;
begin
  if p_room_id is null or length(trim(p_room_id)) < 1 then
    raise exception 'invalid room id' using errcode = '22023';
  end if;
  begin
    v_member_key := trim(p_member_key)::uuid;
  exception when others then
    raise exception 'invalid member_key' using errcode = '22023';
  end;

  if not exists (
    select 1 from public.room_members as rm
    where rm.room_id = p_room_id and rm.member_key = v_member_key
  ) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  insert into public.room_movie_proposals as p (
    room_id,
    imdb_id,
    title,
    poster_url,
    release_year,
    member_key,
    nickname
  )
  values (
    p_room_id,
    trim(p_imdb_id),
    trim(p_title),
    p_poster_url,
    p_release_year,
    v_member_key,
    trim(p_nickname)
  )
  on conflict (room_id, imdb_id) do update
  set
    title = excluded.title,
    poster_url = excluded.poster_url,
    release_year = excluded.release_year,
    nickname = excluded.nickname,
    member_key = excluded.member_key
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.fetch_room_proposals(text, text) from public;
revoke all on function public.propose_room_movie(text, text, text, text, text, text, text) from public;
grant execute on function public.fetch_room_proposals(text, text) to anon;
grant execute on function public.fetch_room_proposals(text, text) to authenticated;
grant execute on function public.propose_room_movie(text, text, text, text, text, text, text) to anon;
grant execute on function public.propose_room_movie(text, text, text, text, text, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_movie_proposals'
  ) then
    alter publication supabase_realtime add table public.room_movie_proposals;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Playback state + RPCs (from 015)
-- ---------------------------------------------------------------------------
create table if not exists public.room_playback_state (
  room_id text primary key references public.rooms (id) on delete cascade,
  source_type text not null default 'none'
    check (source_type in ('none', 'youtube_trailer', 'host_media')),
  imdb_id text,
  movie_title text,
  youtube_video_id text,
  media_session_id uuid,
  host_member_key uuid,
  status text not null default 'idle'
    check (status in ('idle', 'playing', 'paused', 'buffering')),
  position_sec double precision not null default 0,
  playback_rate double precision not null default 1,
  duration_sec double precision,
  revision bigint not null default 0,
  action_id uuid,
  action_type text,
  authoritative_ts bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists room_playback_state_host_idx on public.room_playback_state (host_member_key);

alter table public.rooms
  add column if not exists playback_sync_target integer not null default 10
    check (playback_sync_target >= 2 and playback_sync_target <= 16);

create or replace function public.room_member_exists(p_room_id text, p_member_key uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.member_key = p_member_key
  );
$$;

revoke all on function public.room_member_exists(text, uuid) from public;
grant execute on function public.room_member_exists(text, uuid) to anon;
grant execute on function public.room_member_exists(text, uuid) to authenticated;

-- Signature: (p_room_id text, p_member_key text) — client must use these exact names
create or replace function public.get_room_playback_state(
  p_room_id text,
  p_member_key text
)
returns setof public.room_playback_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
begin
  if p_room_id is null or length(trim(p_room_id)) < 1 then
    raise exception 'invalid room id' using errcode = '22023';
  end if;
  begin
    v_member_key := trim(p_member_key)::uuid;
  exception when others then
    raise exception 'invalid member_key' using errcode = '22023';
  end;

  if not public.room_member_exists(p_room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  return query
  select *
  from public.room_playback_state as rps
  where rps.room_id = p_room_id;
end;
$$;

create or replace function public.apply_playback_action(
  p_room_id text,
  p_member_key text,
  p_action jsonb
)
returns public.room_playback_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_host uuid;
  v_row public.room_playback_state;
  v_type text;
  v_rev bigint;
  v_pos double precision;
  v_rate double precision;
  v_status text;
  v_now bigint;
begin
  if p_action is null or p_action = 'null'::jsonb then
    raise exception 'missing action' using errcode = '22023';
  end if;

  begin
    v_member_key := trim(p_member_key)::uuid;
  exception when others then
    raise exception 'invalid member_key' using errcode = '22023';
  end;

  if not public.room_member_exists(p_room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  select r.host_member_key into v_host
  from public.rooms as r
  where r.id = p_room_id;

  if v_host is distinct from v_member_key then
    raise exception 'only host can control playback' using errcode = '42501';
  end if;

  v_type := coalesce(p_action->>'type', '');
  v_rev := coalesce((p_action->>'expectedRevision')::bigint, -1);

  select * into v_row
  from public.room_playback_state as rps
  where rps.room_id = p_room_id
  for update;

  if not found then
    insert into public.room_playback_state (room_id, host_member_key)
    values (p_room_id, v_host)
    returning * into v_row;
  end if;

  if v_rev >= 0 and v_rev < v_row.revision then
    raise exception 'stale revision' using errcode = '22023';
  end if;

  v_now := (extract(epoch from now()) * 1000)::bigint;
  v_pos := v_row.position_sec;
  v_rate := v_row.playback_rate;
  v_status := v_row.status;

  if v_type = 'select_source' then
    v_row.source_type := coalesce(p_action->>'sourceType', 'none');
    v_row.imdb_id := p_action->>'imdbId';
    v_row.movie_title := p_action->>'movieTitle';
    v_row.youtube_video_id := p_action->>'youtubeVideoId';
    v_row.media_session_id := nullif(p_action->>'mediaSessionId', '')::uuid;
    v_row.position_sec := 0;
    v_row.status := 'idle';
    v_row.duration_sec := nullif(p_action->>'durationSec', '')::double precision;
  elsif v_type = 'play' then
    v_pos := coalesce((p_action->>'positionSec')::double precision, v_row.position_sec);
    v_status := 'playing';
  elsif v_type = 'pause' then
    v_pos := coalesce((p_action->>'positionSec')::double precision, v_row.position_sec);
    v_status := 'paused';
  elsif v_type = 'seek' then
    v_pos := greatest(0, coalesce((p_action->>'positionSec')::double precision, 0));
    v_status := coalesce(p_action->>'status', v_row.status);
  elsif v_type = 'skip_forward' then
    v_pos := greatest(0, v_row.position_sec + coalesce((p_action->>'deltaSec')::double precision, 10));
  elsif v_type = 'skip_back' then
    v_pos := greatest(0, v_row.position_sec - coalesce((p_action->>'deltaSec')::double precision, 10));
  elsif v_type = 'buffering' then
    v_status := 'buffering';
    v_pos := coalesce((p_action->>'positionSec')::double precision, v_row.position_sec);
  elsif v_type = 'ready' then
    v_status := coalesce(p_action->>'status', 'paused');
    v_pos := coalesce((p_action->>'positionSec')::double precision, v_row.position_sec);
    v_row.duration_sec := coalesce(nullif(p_action->>'durationSec', '')::double precision, v_row.duration_sec);
  elsif v_type = 'rate' then
    v_rate := greatest(0.25, least(2, coalesce((p_action->>'playbackRate')::double precision, 1)));
  else
    raise exception 'unknown action type' using errcode = '22023';
  end if;

  v_row.revision := v_row.revision + 1;
  v_row.action_id := gen_random_uuid();
  v_row.action_type := v_type;
  v_row.position_sec := v_pos;
  v_row.playback_rate := v_rate;
  v_row.status := v_status;
  v_row.host_member_key := v_host;
  v_row.authoritative_ts := v_now;
  v_row.updated_at := now();

  update public.room_playback_state as rps
  set
    source_type = v_row.source_type,
    imdb_id = v_row.imdb_id,
    movie_title = v_row.movie_title,
    youtube_video_id = v_row.youtube_video_id,
    media_session_id = v_row.media_session_id,
    host_member_key = v_row.host_member_key,
    status = v_row.status,
    position_sec = v_row.position_sec,
    playback_rate = v_row.playback_rate,
    duration_sec = v_row.duration_sec,
    revision = v_row.revision,
    action_id = v_row.action_id,
    action_type = v_row.action_type,
    authoritative_ts = v_row.authoritative_ts,
    updated_at = v_row.updated_at
  where rps.room_id = p_room_id;

  return v_row;
end;
$$;

revoke all on function public.get_room_playback_state(text, text) from public;
revoke all on function public.apply_playback_action(text, text, jsonb) from public;
grant execute on function public.get_room_playback_state(text, text) to anon;
grant execute on function public.apply_playback_action(text, text, jsonb) to anon;
grant execute on function public.get_room_playback_state(text, text) to authenticated;
grant execute on function public.apply_playback_action(text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
