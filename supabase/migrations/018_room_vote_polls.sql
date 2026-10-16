-- Room-wide trailer vote polls (30s default), ballots, secure RPCs.

create table if not exists public.room_vote_polls (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  proposer_member_key uuid not null,
  proposer_nickname text not null,
  imdb_id text not null,
  title text not null,
  poster_url text,
  release_year text,
  youtube_video_id text,
  status text not null default 'open' check (status in ('open', 'finalized', 'cancelled')),
  result text check (result is null or result in ('passed', 'failed')),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists room_vote_polls_room_open_idx
  on public.room_vote_polls (room_id, status, expires_at desc);

create table if not exists public.room_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_vote_polls (id) on delete cascade,
  member_key uuid not null,
  vote smallint not null check (vote in (-1, 1)),
  updated_at timestamptz not null default now(),
  unique (poll_id, member_key)
);

create index if not exists room_vote_ballots_poll_idx on public.room_vote_ballots (poll_id);

alter table public.room_vote_polls enable row level security;
alter table public.room_vote_ballots enable row level security;

create policy "room_vote_polls_select_member"
  on public.room_vote_polls for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_vote_polls.room_id
    )
  );

create policy "room_vote_ballots_select_member"
  on public.room_vote_ballots for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.room_vote_polls p
      join public.room_members rm on rm.room_id = p.room_id
      where p.id = room_vote_ballots.poll_id
    )
  );

-- ---------------------------------------------------------------------------
create or replace function public.room_member_exists_uuid(p_room_id text, p_member_key uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.member_key = p_member_key
  );
$$;

create or replace function public.start_room_vote_poll(
  p_room_id text,
  p_member_key text,
  p_nickname text,
  p_imdb_id text,
  p_title text,
  p_poster_url text default null,
  p_release_year text default null,
  p_youtube_video_id text default null,
  p_duration_sec integer default 30
)
returns public.room_vote_polls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_row public.room_vote_polls;
  v_secs integer;
begin
  v_member_key := trim(p_member_key)::uuid;
  if not public.room_member_exists_uuid(p_room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;
  v_secs := greatest(10, least(120, coalesce(p_duration_sec, 30)));

  insert into public.room_vote_polls (
    room_id,
    proposer_member_key,
    proposer_nickname,
    imdb_id,
    title,
    poster_url,
    release_year,
    youtube_video_id,
    expires_at
  )
  values (
    p_room_id,
    v_member_key,
    trim(p_nickname),
    trim(p_imdb_id),
    trim(p_title),
    p_poster_url,
    p_release_year,
    nullif(trim(p_youtube_video_id), ''),
    now() + make_interval(secs => v_secs)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cast_room_vote(
  p_poll_id uuid,
  p_member_key text,
  p_vote smallint
)
returns public.room_vote_ballots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_poll public.room_vote_polls;
  v_ballot public.room_vote_ballots;
begin
  v_member_key := trim(p_member_key)::uuid;
  if p_vote not in (-1, 1) then
    raise exception 'invalid vote' using errcode = '22023';
  end if;

  select * into v_poll from public.room_vote_polls where id = p_poll_id for update;
  if not found then raise exception 'poll not found' using errcode = 'P0002'; end if;
  if v_poll.status <> 'open' or v_poll.expires_at <= now() then
    raise exception 'poll closed' using errcode = '22023';
  end if;
  if not public.room_member_exists_uuid(v_poll.room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;
  if v_poll.proposer_member_key = v_member_key then
    raise exception 'proposer cannot vote' using errcode = '42501';
  end if;

  insert into public.room_vote_ballots (poll_id, member_key, vote)
  values (p_poll_id, v_member_key, p_vote)
  on conflict (poll_id, member_key) do update
  set vote = excluded.vote, updated_at = now()
  returning * into v_ballot;

  return v_ballot;
end;
$$;

create or replace function public.finalize_room_vote_poll(p_poll_id uuid, p_member_key text)
returns public.room_vote_polls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_poll public.room_vote_polls;
  v_up integer;
  v_down integer;
begin
  v_member_key := trim(p_member_key)::uuid;
  select * into v_poll from public.room_vote_polls where id = p_poll_id for update;
  if not found then raise exception 'poll not found' using errcode = 'P0002'; end if;
  if not public.room_member_exists_uuid(v_poll.room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;
  if v_poll.status = 'finalized' then return v_poll; end if;
  if v_poll.status <> 'open' then raise exception 'poll not open' using errcode = '22023'; end if;
  if v_poll.expires_at > now() then
    raise exception 'poll not expired' using errcode = '22023';
  end if;

  select
    count(*) filter (where b.vote = 1),
    count(*) filter (where b.vote = -1)
  into v_up, v_down
  from public.room_vote_ballots b
  where b.poll_id = p_poll_id;

  update public.room_vote_polls
  set
    status = 'finalized',
    result = case when v_up > 0 and v_up > v_down then 'passed' else 'failed' end,
    finalized_at = now()
  where id = p_poll_id
  returning * into v_poll;

  return v_poll;
end;
$$;

create or replace function public.get_room_vote_poll(
  p_poll_id uuid,
  p_member_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_key uuid;
  v_poll public.room_vote_polls;
  v_up integer;
  v_down integer;
  v_eligible integer;
begin
  v_member_key := trim(p_member_key)::uuid;
  select * into v_poll from public.room_vote_polls where id = p_poll_id;
  if not found then return null; end if;
  if not public.room_member_exists_uuid(v_poll.room_id, v_member_key) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  select count(*) filter (where b.vote = 1), count(*) filter (where b.vote = -1)
  into v_up, v_down
  from public.room_vote_ballots b where b.poll_id = p_poll_id;

  select count(*)::integer into v_eligible
  from public.room_members rm
  where rm.room_id = v_poll.room_id and rm.member_key <> v_poll.proposer_member_key;

  return jsonb_build_object(
    'poll', to_jsonb(v_poll),
    'up', v_up,
    'down', v_down,
    'eligible', v_eligible,
    'my_vote', (select b.vote from public.room_vote_ballots b where b.poll_id = p_poll_id and b.member_key = v_member_key)
  );
end;
$$;

create or replace function public.fetch_open_room_vote_polls(p_room_id text, p_member_key text)
returns setof public.room_vote_polls
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.room_vote_polls p
  where p.room_id = p_room_id
    and p.status = 'open'
    and public.room_member_exists_uuid(p_room_id, trim(p_member_key)::uuid)
  order by p.created_at desc
  limit 5;
$$;

grant execute on function public.start_room_vote_poll(text, text, text, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.cast_room_vote(uuid, text, smallint) to anon, authenticated;
grant execute on function public.finalize_room_vote_poll(uuid, text) to anon, authenticated;
grant execute on function public.get_room_vote_poll(uuid, text) to anon, authenticated;
grant execute on function public.fetch_open_room_vote_polls(text, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_vote_polls'
  ) then
    alter publication supabase_realtime add table public.room_vote_polls;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_vote_ballots'
  ) then
    alter publication supabase_realtime add table public.room_vote_ballots;
  end if;
end $$;

notify pgrst, 'reload schema';
