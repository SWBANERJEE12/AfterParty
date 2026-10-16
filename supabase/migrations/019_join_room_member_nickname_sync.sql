-- Sync nickname on rejoin and return canonical nickname to the client.
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
  v_nickname text;
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
    update public.room_members as rm
    set nickname = trim(p_nickname)
    where rm.room_id = p_room_id
      and rm.member_key = p_member_key
      and rm.nickname is distinct from trim(p_nickname);

    select rm.nickname into v_nickname
    from public.room_members as rm
    where rm.room_id = p_room_id
      and rm.member_key = p_member_key;

    return jsonb_build_object('ok', true, 'rejoined', true, 'nickname', v_nickname);
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

  if v_created_by is not null and v_uid = v_created_by then
    update public.rooms as r
    set host_member_key = coalesce(r.host_member_key, p_member_key),
        host_user_id = coalesce(r.host_user_id, v_uid)
    where r.id = p_room_id;
  end if;

  return jsonb_build_object('ok', true, 'rejoined', false, 'nickname', trim(p_nickname));
end;
$$;
