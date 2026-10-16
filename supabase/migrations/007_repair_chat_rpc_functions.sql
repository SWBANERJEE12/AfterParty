-- =============================================================================
-- Afterparty: repair chat RPCs for Supabase JS named-parameter calls
--
-- Prerequisites (must already be applied):
--   001_watch_party.sql   → public.rooms, public.room_members
--   002_room_chat_realtime.sql → public.room_messages
--
-- Safe to re-run: policies idempotent; functions CREATE OR REPLACE.
-- Does not DELETE rows. Does not touch 005 proposals or other functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema reference (from 001 / 002 — do not alter tables here)
-- ---------------------------------------------------------------------------
-- public.rooms:           id text PK, created_at timestamptz
-- public.room_members:      id uuid PK, room_id text FK, nickname text (1–24),
--                           member_key uuid, joined_at timestamptz
-- public.room_messages:     id uuid PK, room_id text FK, member_key uuid,
--                           nickname text (1–24), body text (1–2000),
--                           created_at timestamptz
--
-- Frontend RPC (src/hooks/useRoomChat.ts):
--   fetch_room_messages({ p_room_id, p_member_key, p_limit })
--   post_room_message({ p_room_id, p_member_key, p_nickname, p_body })
-- History row / post return: id, room_id, member_key, nickname, body, created_at
-- ---------------------------------------------------------------------------

-- RLS: keep 003 intent — members-only insert; no anon SELECT on messages
drop policy if exists "room_messages_select_anon" on public.room_messages;
drop policy if exists "room_messages_insert_anon" on public.room_messages;
drop policy if exists "room_messages_insert_member" on public.room_messages;

create policy "room_messages_insert_member"
  on public.room_messages
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.room_members as rm
      where rm.room_id = room_messages.room_id
        and rm.member_key = room_messages.member_key
    )
    and char_length(room_messages.body) between 1 and 2000
  );

revoke select on table public.room_messages from anon;

-- Drop only legacy overloads introduced in 003/004 (uuid p_member_key).
-- Required before creating (text, text, integer) overload; CREATE OR REPLACE
-- cannot change argument types. Does not scan/drop unrelated functions.
drop function if exists public.fetch_room_messages(text, uuid, integer);
drop function if exists public.post_room_message(text, uuid, text, text);

-- ---------------------------------------------------------------------------
-- public.fetch_room_messages
-- Arg names MUST match PostgREST named RPC: p_room_id, p_member_key, p_limit
-- p_member_key is text in API (JS UUID string); cast to uuid inside.
-- ---------------------------------------------------------------------------
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
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_member_key uuid;
  v_limit integer;
begin
  if p_room_id is null or length(trim(p_room_id)) < 1 then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  begin
    v_member_key := trim(p_member_key)::uuid;
  exception
    when invalid_text_representation then
      raise exception 'invalid member_key' using errcode = '22023';
  end;

  if not exists (
    select 1
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.member_key = v_member_key
  ) then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 200);

  return query
  select
    m.id,
    m.room_id,
    m.member_key,
    m.nickname,
    m.body,
    m.created_at
  from public.room_messages as m
  where m.room_id = p_room_id
  order by m.created_at asc
  limit v_limit;
end;
$function$;

-- ---------------------------------------------------------------------------
-- public.post_room_message
-- Returns one public.room_messages row (JSON object to client).
-- Nickname persisted from public.room_members (client p_nickname ignored for insert).
-- ---------------------------------------------------------------------------
create or replace function public.post_room_message(
  p_room_id text,
  p_member_key text,
  p_nickname text,
  p_body text
)
returns public.room_messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.room_messages;
  v_body text;
  v_member_key uuid;
  v_nickname text;
begin
  if p_room_id is null or length(trim(p_room_id)) < 1 then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  begin
    v_member_key := trim(p_member_key)::uuid;
  exception
    when invalid_text_representation then
      raise exception 'invalid member_key' using errcode = '22023';
  end;

  v_body := trim(p_body);
  if length(v_body) < 1 or length(v_body) > 2000 then
    raise exception 'invalid message length' using errcode = '22023';
  end if;

  select rm.nickname
  into v_nickname
  from public.room_members as rm
  where rm.room_id = p_room_id
    and rm.member_key = v_member_key;

  if v_nickname is null then
    raise exception 'not a room member' using errcode = '42501';
  end if;

  insert into public.room_messages as m (
    room_id,
    member_key,
    nickname,
    body
  )
  values (
    p_room_id,
    v_member_key,
    v_nickname,
    v_body
  )
  returning m.* into v_row;

  return v_row;
end;
$function$;

revoke all on function public.fetch_room_messages(text, text, integer) from public;
grant execute on function public.fetch_room_messages(text, text, integer) to anon;
grant execute on function public.fetch_room_messages(text, text, integer) to authenticated;

revoke all on function public.post_room_message(text, text, text, text) from public;
grant execute on function public.post_room_message(text, text, text, text) to anon;
grant execute on function public.post_room_message(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
