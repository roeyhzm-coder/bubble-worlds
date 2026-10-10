-- עולמות — סכמת מסד נתונים מבודדת (קידומת bw_)
-- בטוח להרצה בפרויקט Supabase משותף: לא נוגע בטבלאות של אפליקציות אחרות.

create extension if not exists pgcrypto;

create table if not exists public.bw_categories (
  id text primary key,
  name text not null,
  color text not null default '#818cf8',
  position_x double precision not null default 50,
  position_y double precision not null default 50,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  container_type text
    check (container_type is null or container_type in ('bubbles', 'list'))
);

create table if not exists public.bw_bubbles (
  id text primary key,
  parent_bubble_id text references public.bw_bubbles (id) on delete cascade,
  category_id text not null references public.bw_categories (id) on delete cascade,
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
    check (streak_mode in ('strict', 'flexible', 'cumulative')),
  container_type text
    check (container_type is null or container_type in ('bubbles', 'list'))
);

alter table public.bw_categories add column if not exists container_type text
  check (container_type is null or container_type in ('bubbles', 'list'));
alter table public.bw_bubbles add column if not exists container_type text
  check (container_type is null or container_type in ('bubbles', 'list'));

create table if not exists public.bw_app_settings (
  key text primary key,
  value jsonb not null
);

create index if not exists bw_bubbles_category_idx on public.bw_bubbles (category_id);
create index if not exists bw_bubbles_parent_idx on public.bw_bubbles (parent_bubble_id);

alter table public.bw_categories enable row level security;
alter table public.bw_bubbles enable row level security;
alter table public.bw_app_settings enable row level security;

drop policy if exists bw_categories_all on public.bw_categories;
create policy bw_categories_all on public.bw_categories
  for all using (true) with check (true);

drop policy if exists bw_bubbles_all on public.bw_bubbles;
create policy bw_bubbles_all on public.bw_bubbles
  for all using (true) with check (true);

drop policy if exists bw_app_settings_all on public.bw_app_settings;
create policy bw_app_settings_all on public.bw_app_settings
  for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.bw_categories;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bw_bubbles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bw_app_settings;
  exception when duplicate_object then null;
  end;
end $$;
