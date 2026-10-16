-- SUPERSEDED: apply 007_repair_chat_rpc_functions.sql instead (drops all overloads + stricter membership).
-- Fix chat RPCs for PostgREST / Supabase JS (apply in SQL Editor if fetch_room_messages is missing).
-- Safe to re-run: replaces functions and refreshes the API schema cache.
-- Membership checks unchanged: only room_members with matching member_key may read/post.

-- Policies from 003 (idempotent)
drop policy if exists "room_messages_select_anon" on public.room_messages;
drop policy if exists "room_messages_insert_anon" on public.room_messages;
drop policy if exists "room_messages_insert_member" on public.room_messages;

create policy "room_messages_insert_member"
  on public.room_messages for insert
  to anon
  with check (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = room_messages.room_id
        and rm.member_key = room_messages.member_key
    )
    and char_length(body) between 1 and 2000
  );

revoke select on public.room_messages from anon;

-- Drop legacy signatures (uuid member_key) so PostgREST has a single overload
drop function if exists public.fetch_room_messages(text, uuid, int);
drop function if exists public.post_room_message(text, uuid, text, text);

-- Client sends member_key as text (session UUID string); cast inside the function.
create or replace function public.fetch_room_messages(
  p_room_id text,
  p_member_key text,
  p_limit integer default 100
)
returns table (
  id uuid,
  room_id text,
  member_key uuid,
  nickname text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.room_id, m.member_key, m.nickname, m.body, m.created_at
  from public.room_messages m
  where m.room_id = p_room_id
    and exists (
      select 1
      from public.room_members rm
      where rm.room_id = p_room_id
        and rm.member_key = p_member_key::uuid
    )
  order by m.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.post_room_message(
  p_room_id text,
  p_member_key text,
  p_nickname text,
  p_body text
)
returns public.room_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.room_messages;
  cleaned text := trim(p_body);
  mid uuid := p_member_key::uuid;
begin
  if char_length(cleaned) < 1 or char_length(cleaned) > 2000 then
    raise exception 'invalid message length';
  end if;
  if char_length(p_nickname) < 1 or char_length(p_nickname) > 24 then
    raise exception 'invalid nickname';
  end if;
  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.member_key = mid
  ) then
    raise exception 'not a room member';
  end if;

  insert into public.room_messages (room_id, member_key, nickname, body)
  values (p_room_id, mid, p_nickname, cleaned)
  returning * into msg;

  return msg;
end;
$$;

revoke all on function public.fetch_room_messages(text, text, integer) from public;
grant execute on function public.fetch_room_messages(text, text, integer) to anon;
grant execute on function public.fetch_room_messages(text, text, integer) to authenticated;

revoke all on function public.post_room_message(text, text, text, text) from public;
grant execute on function public.post_room_message(text, text, text, text) to anon;
grant execute on function public.post_room_message(text, text, text, text) to authenticated;

-- Ask PostgREST to reload the schema cache (Supabase API)
notify pgrst, 'reload schema';
