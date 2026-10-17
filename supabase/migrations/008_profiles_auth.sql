-- Profiles for Supabase Auth users (apply after 001–007).
-- Username login uses synthetic email: lower(username) || '@auth.afterparty.local' (see src/auth/username.ts).
-- Idempotent: safe to re-run after a partial SQL Editor apply (policies recreated).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  preferences jsonb not null default '{}'::jsonb,
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 32),
  constraint profiles_username_unique unique (username)
);

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_display text;
begin
  v_username := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_display := trim(coalesce(new.raw_user_meta_data ->> 'display_name', v_username));

  if v_username = '' or v_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'invalid username metadata';
  end if;

  if char_length(v_display) < 1 or char_length(v_display) > 32 then
    v_display := v_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
