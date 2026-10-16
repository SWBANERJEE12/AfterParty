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

create index if not exists room_movie_proposals_room_idx on public.room_movie_proposals (room_id, created_at desc);

alter table public.room_movie_proposals enable row level security;

create policy "room_movie_proposals_select_member"
  on public.room_movie_proposals for select
  to anon
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_movie_proposals.room_id
    )
  );

create policy "room_movie_proposals_insert_member"
  on public.room_movie_proposals for insert
  to anon
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_movie_proposals.room_id
        and rm.member_key = room_movie_proposals.member_key
    )
  );

create or replace function public.fetch_room_proposals(p_room_id text, p_member_key uuid)
returns setof public.room_movie_proposals
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.room_movie_proposals p
  where p.room_id = p_room_id
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = p_room_id and rm.member_key = p_member_key
    )
  order by p.created_at desc
  limit 20;
$$;

grant execute on function public.fetch_room_proposals(text, uuid) to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_movie_proposals'
  ) then
    alter publication supabase_realtime add table public.room_movie_proposals;
  end if;
end $$;
