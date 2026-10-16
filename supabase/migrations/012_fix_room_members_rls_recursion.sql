-- Fix infinite recursion in authenticated RLS on room_members (from 011).
--
-- Root cause: room_members_select_authenticated reads public.room_members inside
-- its own USING clause, and rooms_select_authenticated reads room_members which
-- re-triggers room_members policies (Postgres error 42P17).
--
-- Safe pattern: membership / creator checks in SECURITY DEFINER helpers with
-- fixed search_path and fully qualified tables (bypass RLS as function owner).
-- Does not change chat RPCs (007) or anon guest policies (001).

-- ---------------------------------------------------------------------------
-- Helper: may this authenticated user see data for p_room_id?
-- (creator of the room, or room_members row linked to auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.auth_user_can_access_room(p_room_id text)
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
      and r.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
  );
$$;

revoke all on function public.auth_user_can_access_room(text) from public;
grant execute on function public.auth_user_can_access_room(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Replace 011 SELECT policies that subquery room_members from RLS expressions
-- (INSERT/DELETE policies from 011 are unchanged)
-- ---------------------------------------------------------------------------
drop policy if exists "rooms_select_authenticated" on public.rooms;

create policy "rooms_select_authenticated"
  on public.rooms
  for select
  to authenticated
  using (public.auth_user_can_access_room(id));

drop policy if exists "room_members_select_authenticated" on public.room_members;

create policy "room_members_select_authenticated"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.auth_user_can_access_room(room_id)
  );

notify pgrst, 'reload schema';
