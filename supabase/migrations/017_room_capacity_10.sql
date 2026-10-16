-- Raise default watch-room capacity from 4 to 10 (atomic join still uses rooms.max_members).

alter table public.rooms
  alter column max_members set default 10;

update public.rooms
set max_members = 10
where max_members = 4;

notify pgrst, 'reload schema';
