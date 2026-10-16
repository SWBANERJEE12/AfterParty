-- Ensure chat RPCs match Supabase JS named params (p_member_key as text, not uuid).
-- Apply if PostgREST reports: fetch_room_messages(p_limit, p_member_key, p_room_id) not in schema cache.
--
-- Cause: migration 003 created fetch_room_messages(text, uuid, int). The client sends
-- p_member_key as a string; PostgREST requires the (text, text, integer) overload.
-- CREATE OR REPLACE cannot change argument types — drop legacy overloads first.
--
-- Does not alter RLS, tables, or unrelated functions. Same behavior as 007 chat RPC bodies.

drop function if exists public.fetch_room_messages(text, uuid, integer);
drop function if exists public.fetch_room_messages(text, uuid, int);
drop function if exists public.post_room_message(text, uuid, text, text);

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
