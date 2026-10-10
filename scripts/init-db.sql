-- עולמות — סכמת מסד נתונים ל-Supabase
-- הרצה ב-SQL Editor או: supabase db execute -f scripts/init-db.sql

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  color text not null default '#818cf8',
  position_x double precision not null default 50,
  position_y double precision not null default 50,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bubbles (
  id text primary key,
  parent_bubble_id text references public.bubbles (id) on delete cascade,
  category_id text not null references public.categories (id) on delete cascade,
  title text not null,
  notes text not null default '',
  color text not null default '#94a3b8',
  status text not null default 'default'
    check (status in ('active_tracking', 'focus', 'deep_thought', 'default')),
  position_x double precision not null default 50,
  position_y double precision not null default 50,
  size_multiplier double precision not null default 1,
  created_at timestamptz not null default now(),
  is_tracking boolean not null default false,
  target_days integer not null default 30,
  weekly_frequency integer not null default 7,
  tracking_history jsonb not null default '[]'::jsonb,
  streak_mode text not null default 'flexible'
    check (streak_mode in ('strict', 'flexible', 'cumulative'))
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

create index if not exists bubbles_category_idx on public.bubbles (category_id);
create index if not exists bubbles_parent_idx on public.bubbles (parent_bubble_id);

alter table public.categories enable row level security;
alter table public.bubbles enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories
  for all using (true) with check (true);

drop policy if exists bubbles_all on public.bubbles;
create policy bubbles_all on public.bubbles
  for all using (true) with check (true);

drop policy if exists app_settings_all on public.app_settings;
create policy app_settings_all on public.app_settings
  for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.categories;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bubbles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.app_settings;
  exception when duplicate_object then null;
  end;
end $$;
