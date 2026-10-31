-- Esquema base. Las tablas se crean sin privilegios: los permisos se conceden en la migración de RLS.

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, public;

-- Esquema no expuesto por la API: helpers internos y copia del calendario del programa.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  avatar_url text check (char_length(avatar_url) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  daily_calorie_goal integer not null default 2000 check (daily_calorie_goal between 1 and 20000),
  rest_between_sets_seconds integer not null default 45 check (rest_between_sets_seconds between 5 and 600),
  rest_between_exercises_seconds integer not null default 60 check (rest_between_exercises_seconds between 5 and 600),
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  global_day integer not null default 1 check (global_day >= 1),
  updated_at timestamptz not null default now()
);

-- cycle_day y cycle_number son columnas generadas: derivan de global_day y nadie puede escribirlas.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  global_day integer not null check (global_day >= 1),
  cycle_day integer not null generated always as (((global_day - 1) % 31) + 1) stored check (cycle_day between 1 and 31),
  cycle_number integer not null generated always as (((global_day - 1) / 31) + 1) stored check (cycle_number >= 1),
  day_type text not null check (day_type in ('strength_cardio', 'strength', 'cardio', 'active_rest')),
  routine text check (routine in ('A', 'B')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_seconds integer check (total_seconds between 0 and 172800),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  unique (user_id, global_day),
  unique (id, user_id),
  check ((status = 'completed') = (completed_at is not null))
);

-- La FK compuesta impide colgar registros de la sesión de otro usuario.
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_key text not null check (exercise_key in (
    'squat', 'pushup', 'lunge', 'glute_bridge', 'calf_raise', 'plank',
    'reverse_lunge', 'chair_dip', 'leg_raise', 'side_plank'
  )),
  set_number integer not null check (set_number between 1 and 3),
  side text check (side in ('left', 'right')),
  target text not null check (char_length(target) <= 50),
  duration_seconds integer not null check (duration_seconds between 0 and 7200),
  completed_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  unique nulls not distinct (session_id, exercise_key, set_number, side)
);

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_minutes integer not null check (target_minutes between 1 and 180),
  actual_seconds integer not null check (actual_seconds between 0 and 14400),
  completed_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  unique (session_id)
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  global_day integer not null check (global_day >= 1),
  cycle_day integer not null generated always as (((global_day - 1) % 31) + 1) stored check (cycle_day between 1 and 31),
  cycle_number integer not null generated always as (((global_day - 1) / 31) + 1) stored check (cycle_number >= 1),
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  logged_at timestamptz not null default now(),
  unique (user_id, global_day)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  name text not null check (char_length(name) between 1 and 120),
  calories integer not null check (calories between 0 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercise_logs_user_id_idx on public.exercise_logs (user_id);
create index cardio_logs_user_id_idx on public.cardio_logs (user_id);
create index weight_logs_user_id_logged_at_idx on public.weight_logs (user_id, logged_at);
create index food_logs_user_id_log_date_idx on public.food_logs (user_id, log_date);

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger user_settings_touch_updated_at before update on public.user_settings
  for each row execute function private.touch_updated_at();
create trigger user_progress_touch_updated_at before update on public.user_progress
  for each row execute function private.touch_updated_at();
create trigger food_logs_touch_updated_at before update on public.food_logs
  for each row execute function private.touch_updated_at();
