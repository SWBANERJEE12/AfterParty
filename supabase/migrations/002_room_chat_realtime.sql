-- Afterparty: realtime chat messages (run after 001_watch_party.sql)

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  member_key uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_id_created_idx
  on public.room_messages (room_id, created_at desc);

alter table public.room_messages enable row level security;

-- Private rooms: possession of room_id is the shared secret (guest / anon phase).
create policy "room_messages_select_anon"
  on public.room_messages for select
  to anon
  using (
    exists (select 1 from public.rooms r where r.id = room_id)
  );

create policy "room_messages_insert_anon"
  on public.room_messages for insert
  to anon
  with check (
    exists (select 1 from public.rooms r where r.id = room_id)
    and char_length(body) between 1 and 2000
  );

-- Realtime: postgres changes for chat
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_messages'
  ) then
    alter publication supabase_realtime add table public.room_messages;
  end if;
end $$;
