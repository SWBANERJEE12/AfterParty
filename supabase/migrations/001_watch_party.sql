-- Afterparty: private watch-party rooms + membership (foundation)
-- Apply in order: 001, then 002_room_chat_realtime.sql
-- Supabase Dashboard → SQL → New query → paste → Run

create table if not exists public.rooms (
  id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  member_key uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create index if not exists room_members_room_id_idx on public.room_members (room_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Guest access: room id acts as the shared secret (Phase 1).
-- Tighten these policies when you add authenticated users.
create policy "rooms_select_anon"
  on public.rooms for select
  to anon
  using (true);

create policy "rooms_insert_anon"
  on public.rooms for insert
  to anon
  with check (true);

create policy "room_members_select_anon"
  on public.room_members for select
  to anon
  using (true);

create policy "room_members_insert_anon"
  on public.room_members for insert
  to anon
  with check (true);

create policy "room_members_delete_own"
  on public.room_members for delete
  to anon
  using (true);

-- Realtime: enable replication for presence-style member list (Dashboard → Database → Replication)
-- Tables: room_members (optional, for postgres changes)
-- Recommended: use Realtime Presence on client channels (no extra table).
