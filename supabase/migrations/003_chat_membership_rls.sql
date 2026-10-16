-- Chat: require room membership for writes; history via verified RPC (not room_id alone).

drop policy if exists "room_messages_select_anon" on public.room_messages;
drop policy if exists "room_messages_insert_anon" on public.room_messages;

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

create or replace function public.fetch_room_messages(
  p_room_id text,
  p_member_key uuid,
  p_limit int default 100
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
        and rm.member_key = p_member_key
    )
  order by m.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.fetch_room_messages(text, uuid, int) from public;
grant execute on function public.fetch_room_messages(text, uuid, int) to anon;
