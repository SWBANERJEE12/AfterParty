-- Phase 2: 4-member cap (atomic), host tracking, join/leave/transfer RPCs.
-- Preserves chat RPCs and existing RLS; membership writes go through SECURITY DEFINER functions.

alter table public.rooms
  add column if not exists max_members integer not null default 4
    check (max_members >= 2 and max_members <= 16);

alter table public.rooms
  add column if not exists host_member_key uuid;

alter table public.rooms
  add column if not exists host_user_id uuid references auth.users (id) on delete set null;

create index if not exists rooms_host_member_key_idx on public.rooms (host_member_key);

-- ---------------------------------------------------------------------------
-- Promote earliest remaining member when host leaves (auto host recovery)
-- ---------------------------------------------------------------------------
create or replace function public.promote_next_room_host(p_room_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_key uuid;
  v_next_user uuid;
begin
  select rm.member_key, rm.user_id
  into v_next_key, v_next_user
  from public.room_members as rm
  where rm.room_id = p_room_id
  order by rm.joined_at asc
  limit 1;

  if v_next_key is null then
    update public.rooms as r
    set host_member_key = null,
        host_user_id = null
    where r.id = p_room_id;
    return;
  end if;

  update public.rooms as r
  set host_member_key = v_next_key,
      host_user_id = v_next_user
  where r.id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room_member — atomic capacity check
-- ---------------------------------------------------------------------------
create or replace function public.join_room_member(
  p_room_id text,
  p_nickname text,
  p_member_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_count integer;
  v_uid uuid;
  v_created_by uuid;
begin
  if p_room_id is null or length(trim(p_room_id)) < 1 then
    raise exception 'invalid room id' using errcode = '22023';
  end if;
  if p_nickname is null or length(trim(p_nickname)) < 1 or length(trim(p_nickname)) > 24 then
    raise exception 'invalid nickname' using errcode = '22023';
  end if;
  if p_member_key is null then
    raise exception 'invalid member_key' using errcode = '22023';
  end if;

  select r.max_members, r.created_by
  into v_max, v_created_by
  from public.rooms as r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  v_uid := auth.uid();

  if exists (
    select 1
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.member_key = p_member_key
  ) then
    return jsonb_build_object('ok', true, 'rejoined', true);
  end if;

  if exists (
    select 1
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.nickname = trim(p_nickname)
      and rm.member_key <> p_member_key
  ) then
    raise exception 'nickname already in use' using errcode = '23505';
  end if;

  select count(*)::integer into v_count
  from public.room_members as rm
  where rm.room_id = p_room_id;

  if v_count >= v_max then
    raise exception 'room is full' using errcode = '53400';
  end if;

  insert into public.room_members as rm (
    room_id,
    nickname,
    member_key,
    user_id
  )
  values (
    p_room_id,
    trim(p_nickname),
    p_member_key,
    v_uid
  );

  -- Host powers (upload/sync): signed-in room creator only (see product decision).
  if v_created_by is not null and v_uid = v_created_by then
    update public.rooms as r
    set host_member_key = coalesce(r.host_member_key, p_member_key),
        host_user_id = coalesce(r.host_user_id, v_uid)
    where r.id = p_room_id;
  end if;

  return jsonb_build_object('ok', true, 'rejoined', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_room_member — auto-promote host when host leaves
-- ---------------------------------------------------------------------------
create or replace function public.leave_room_member(
  p_room_id text,
  p_member_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_host boolean;
begin
  select (r.host_member_key = p_member_key)
  into v_was_host
  from public.rooms as r
  where r.id = p_room_id;

  delete from public.room_members as rm
  where rm.room_id = p_room_id
    and rm.member_key = p_member_key;

  if v_was_host then
    perform public.promote_next_room_host(p_room_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- transfer_room_host — current host only; new host must be signed-in (user_id set)
-- ---------------------------------------------------------------------------
create or replace function public.transfer_room_host(
  p_room_id text,
  p_actor_member_key uuid,
  p_new_host_member_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_key uuid;
  v_new_user uuid;
begin
  select r.host_member_key into v_host_key
  from public.rooms as r
  where r.id = p_room_id
  for update;

  if v_host_key is distinct from p_actor_member_key then
    raise exception 'only the current host can transfer host' using errcode = '42501';
  end if;

  select rm.user_id into v_new_user
  from public.room_members as rm
  where rm.room_id = p_room_id
    and rm.member_key = p_new_host_member_key;

  if v_new_user is null then
    raise exception 'new host must be a signed-in member' using errcode = '22023';
  end if;

  update public.rooms as r
  set host_member_key = p_new_host_member_key,
      host_user_id = v_new_user
  where r.id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_room_party_state(p_room_id text)
returns table (
  host_member_key uuid,
  host_user_id uuid,
  max_members integer,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.host_member_key,
    r.host_user_id,
    r.max_members,
    (select count(*) from public.room_members as rm where rm.room_id = r.id)
  from public.rooms as r
  where r.id = p_room_id;
$$;

revoke all on function public.promote_next_room_host(text) from public;
revoke all on function public.join_room_member(text, text, uuid) from public;
revoke all on function public.leave_room_member(text, uuid) from public;
revoke all on function public.transfer_room_host(text, uuid, uuid) from public;
revoke all on function public.get_room_party_state(text) from public;

grant execute on function public.join_room_member(text, text, uuid) to anon;
grant execute on function public.join_room_member(text, text, uuid) to authenticated;
grant execute on function public.leave_room_member(text, uuid) to anon;
grant execute on function public.leave_room_member(text, uuid) to authenticated;
grant execute on function public.transfer_room_host(text, uuid, uuid) to anon;
grant execute on function public.transfer_room_host(text, uuid, uuid) to authenticated;
grant execute on function public.get_room_party_state(text) to anon;
grant execute on function public.get_room_party_state(text) to authenticated;

notify pgrst, 'reload schema';
