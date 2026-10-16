-- My List + watch history (owner-only via RLS).

create table if not exists public.my_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  imdb_id text not null,
  title text not null,
  poster_url text,
  release_year text,
  added_at timestamptz not null default now(),
  constraint my_list_unique_title unique (user_id, imdb_id)
);

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  imdb_id text not null,
  title text not null,
  poster_url text,
  progress_seconds numeric not null default 0 check (progress_seconds >= 0),
  duration_seconds numeric,
  last_watched_at timestamptz not null default now(),
  constraint watch_history_unique_title unique (user_id, imdb_id)
);

create index if not exists watch_history_user_last_idx on public.watch_history (user_id, last_watched_at desc);

alter table public.my_list_items enable row level security;
alter table public.watch_history enable row level security;

create policy "my_list_select_own"
  on public.my_list_items for select to authenticated using (auth.uid() = user_id);
create policy "my_list_insert_own"
  on public.my_list_items for insert to authenticated with check (auth.uid() = user_id);
create policy "my_list_delete_own"
  on public.my_list_items for delete to authenticated using (auth.uid() = user_id);

create policy "history_select_own"
  on public.watch_history for select to authenticated using (auth.uid() = user_id);
create policy "history_insert_own"
  on public.watch_history for insert to authenticated with check (auth.uid() = user_id);
create policy "history_update_own"
  on public.watch_history for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "history_delete_own"
  on public.watch_history for delete to authenticated using (auth.uid() = user_id);
