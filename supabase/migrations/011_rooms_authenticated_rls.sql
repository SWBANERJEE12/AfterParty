-- Fix: authenticated users could not insert into public.rooms (001 only granted anon policies).
-- Additive: keeps anon guest policies; adds created_by + authenticated RLS.
-- Chat RPCs unchanged (still use room_id + member_key on room_members).

-- ---------------------------------------------------------------------------
-- Schema (actual columns from 001; do not rename existing columns)
-- ---------------------------------------------------------------------------
alter table public.rooms
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create index if not exists rooms_created_by_idx on public.rooms (created_by);

alter table public.room_members
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists room_members_user_id_idx on public.room_members (user_id);

-- ---------------------------------------------------------------------------
-- Helper: invite-link room existence check (one id; does not list all rooms)
-- ---------------------------------------------------------------------------
create or replace function public.check_room_exists(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms as r
    where r.id = p_room_id
  );
$$;

revoke all on function public.check_room_exists(text) from public;
grant execute on function public.check_room_exists(text) to anon;
grant execute on function public.check_room_exists(text) to authenticated;

-- ---------------------------------------------------------------------------
-- authenticated: rooms
-- ---------------------------------------------------------------------------
drop policy if exists "rooms_select_authenticated" on public.rooms;
drop policy if exists "rooms_insert_authenticated" on public.rooms;

create policy "rooms_insert_authenticated"
  on public.rooms
  for insert
  to authenticated
  with check (
    created_by is not null
    and created_by = auth.uid()
  );

create policy "rooms_select_authenticated"
  on public.rooms
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.room_members as rm
      where rm.room_id = rooms.id
        and rm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- authenticated: room_members (join + roster; member_key still used by chat RPCs)
-- ---------------------------------------------------------------------------
drop policy if exists "room_members_select_authenticated" on public.room_members;
drop policy if exists "room_members_insert_authenticated" on public.room_members;
drop policy if exists "room_members_delete_authenticated" on public.room_members;

create policy "room_members_insert_authenticated"
  on public.room_members
  for insert
  to authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and public.check_room_exists(room_id)
  );

create policy "room_members_select_authenticated"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members as me
      where me.room_id = room_members.room_id
        and me.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms as r
      where r.id = room_members.room_id
        and r.created_by = auth.uid()
    )
  );

create policy "room_members_delete_authenticated"
  on public.room_members
  for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
