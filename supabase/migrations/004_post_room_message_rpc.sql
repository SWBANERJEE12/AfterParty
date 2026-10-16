-- Post chat messages via membership-verified RPC (returns full row for broadcast).

create or replace function public.post_room_message(
  p_room_id text,
  p_member_key uuid,
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
      and rm.member_key = p_member_key
  ) then
    raise exception 'not a room member';
  end if;

  insert into public.room_messages (room_id, member_key, nickname, body)
  values (p_room_id, p_member_key, p_nickname, cleaned)
  returning * into msg;

  return msg;
end;
$$;

revoke all on function public.post_room_message(text, uuid, text, text) from public;
grant execute on function public.post_room_message(text, uuid, text, text) to anon;
