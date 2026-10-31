-- RLS forzado y permisos mínimos.
--
-- Se concede por columna para que el progreso y el estado de cierre solo cambien vía complete_day.
-- Una operación sin GRANT ni política queda denegada: es el caso de user_progress (solo lectura) y
-- de insert/delete en profiles y user_settings (las crea el trigger de registro y se borran en
-- cascada con la cuenta).

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_progress enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.cardio_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.food_logs enable row level security;

alter table public.profiles force row level security;
alter table public.user_settings force row level security;
alter table public.user_progress force row level security;
alter table public.workout_sessions force row level security;
alter table public.exercise_logs force row level security;
alter table public.cardio_logs force row level security;
alter table public.weight_logs force row level security;
alter table public.food_logs force row level security;

revoke all on
  public.profiles, public.user_settings, public.user_progress, public.workout_sessions,
  public.exercise_logs, public.cardio_logs, public.weight_logs, public.food_logs
from public, anon, authenticated;

-- profiles
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- user_settings
grant select on public.user_settings to authenticated;
grant update (
  weight_unit, daily_calorie_goal, rest_between_sets_seconds,
  rest_between_exercises_seconds, sound_enabled, vibration_enabled
) on public.user_settings to authenticated;

create policy user_settings_select on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_settings_update on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- user_progress
grant select on public.user_progress to authenticated;

create policy user_progress_select on public.user_progress for select to authenticated
  using ((select auth.uid()) = user_id);

-- workout_sessions: solo se abre la sesión del día activo y solo mientras siga en curso.
grant select, delete on public.workout_sessions to authenticated;
grant insert (id, user_id, global_day, started_at) on public.workout_sessions to authenticated;
grant update (started_at) on public.workout_sessions to authenticated;

create policy workout_sessions_select on public.workout_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workout_sessions_insert on public.workout_sessions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'in_progress'
    and global_day = (select p.global_day from public.user_progress p where p.user_id = (select auth.uid()))
  );
create policy workout_sessions_update on public.workout_sessions for update to authenticated
  using ((select auth.uid()) = user_id and status = 'in_progress')
  with check ((select auth.uid()) = user_id and status = 'in_progress');
create policy workout_sessions_delete on public.workout_sessions for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'in_progress');

-- exercise_logs y cardio_logs: una sesión cerrada es inmutable.
grant select, delete on public.exercise_logs, public.cardio_logs to authenticated;
grant insert (id, session_id, user_id, exercise_key, set_number, side, target, duration_seconds, completed_at)
  on public.exercise_logs to authenticated;
grant update (target, duration_seconds, completed_at) on public.exercise_logs to authenticated;
grant insert (id, session_id, user_id, target_minutes, actual_seconds, completed_at)
  on public.cardio_logs to authenticated;
grant update (actual_seconds, completed_at) on public.cardio_logs to authenticated;

create policy exercise_logs_select on public.exercise_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy exercise_logs_insert on public.exercise_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  );
create policy exercise_logs_update on public.exercise_logs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  )
  with check ((select auth.uid()) = user_id);
create policy exercise_logs_delete on public.exercise_logs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  );

create policy cardio_logs_select on public.cardio_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cardio_logs_insert on public.cardio_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  );
create policy cardio_logs_update on public.cardio_logs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  )
  with check ((select auth.uid()) = user_id);
create policy cardio_logs_delete on public.cardio_logs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.status = 'in_progress')
  );

-- weight_logs: el peso solo se registra o corrige para el día activo.
grant select, delete on public.weight_logs to authenticated;
grant insert (id, user_id, global_day, weight_kg, logged_at) on public.weight_logs to authenticated;
grant update (weight_kg, logged_at) on public.weight_logs to authenticated;

create policy weight_logs_select on public.weight_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy weight_logs_insert on public.weight_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and global_day = (select p.global_day from public.user_progress p where p.user_id = (select auth.uid()))
  );
create policy weight_logs_update on public.weight_logs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and global_day = (select p.global_day from public.user_progress p where p.user_id = (select auth.uid()))
  )
  with check ((select auth.uid()) = user_id);
create policy weight_logs_delete on public.weight_logs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and global_day = (select p.global_day from public.user_progress p where p.user_id = (select auth.uid()))
  );

-- food_logs
grant select, delete on public.food_logs to authenticated;
grant insert (id, user_id, log_date, name, calories) on public.food_logs to authenticated;
grant update (log_date, name, calories) on public.food_logs to authenticated;

create policy food_logs_select on public.food_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy food_logs_insert on public.food_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy food_logs_update on public.food_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy food_logs_delete on public.food_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
