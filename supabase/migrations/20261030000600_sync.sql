-- Escrituras idempotentes para la cola offline. Son SECURITY INVOKER: RLS y los permisos por columna
-- siguen siendo la autoridad. Reciben global_day en lugar del id de sesión para que dos dispositivos
-- con sesiones locales distintas escriban en la misma sesión del servidor.
--
-- Reintentar una escritura de un día ya cerrado no es un error: la cola puede repetir una operación
-- si se perdió la respuesta. Gana la última escritura por registro según su marca de tiempo.

create function public.sync_start_session(p_id uuid, p_global_day integer, p_started_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_day integer;
begin
  select p.global_day into v_current_day from public.user_progress p where p.user_id = auth.uid();

  if not found then
    raise exception 'progress_not_found';
  end if;

  if p_global_day > v_current_day then
    raise exception 'day_mismatch';
  end if;

  if p_global_day < v_current_day then
    return;
  end if;

  insert into public.workout_sessions (id, global_day, started_at)
  values (p_id, p_global_day, p_started_at)
  on conflict do nothing;
end;
$$;

-- Devuelve la sesión abierta del día, null si ya está cerrada y falla si no existe.
create function private.open_session_id(p_global_day integer)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_session public.workout_sessions%rowtype;
begin
  select s.* into v_session
  from public.workout_sessions s
  where s.user_id = auth.uid() and s.global_day = p_global_day;

  if not found then
    raise exception 'session_not_found';
  end if;

  return case when v_session.status = 'in_progress' then v_session.id end;
end;
$$;

create function public.sync_exercise_log(
  p_global_day integer,
  p_exercise_key text,
  p_set_number integer,
  p_side text,
  p_target text,
  p_duration_seconds integer,
  p_completed_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid := private.open_session_id(p_global_day);
begin
  if v_session_id is null then
    return;
  end if;

  insert into public.exercise_logs as l (
    session_id, exercise_key, set_number, side, target, duration_seconds, completed_at
  )
  values (
    v_session_id, p_exercise_key, p_set_number, p_side, p_target, p_duration_seconds, p_completed_at
  )
  on conflict (session_id, exercise_key, set_number, side) do update
  set target = excluded.target,
      duration_seconds = excluded.duration_seconds,
      completed_at = excluded.completed_at
  where l.completed_at <= excluded.completed_at;
end;
$$;

create function public.sync_cardio_log(
  p_global_day integer,
  p_target_minutes integer,
  p_actual_seconds integer,
  p_completed_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid := private.open_session_id(p_global_day);
begin
  if v_session_id is null then
    return;
  end if;

  insert into public.cardio_logs as c (session_id, target_minutes, actual_seconds, completed_at)
  values (v_session_id, p_target_minutes, p_actual_seconds, p_completed_at)
  on conflict (session_id) do update
  set actual_seconds = excluded.actual_seconds,
      completed_at = excluded.completed_at
  where c.completed_at <= excluded.completed_at;
end;
$$;

create function public.sync_weight_log(
  p_id uuid,
  p_global_day integer,
  p_weight_kg numeric,
  p_logged_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_day integer;
begin
  select p.global_day into v_current_day from public.user_progress p where p.user_id = auth.uid();

  if not found then
    raise exception 'progress_not_found';
  end if;

  if p_global_day > v_current_day then
    raise exception 'day_mismatch';
  end if;

  if p_global_day < v_current_day then
    return;
  end if;

  insert into public.weight_logs as w (id, global_day, weight_kg, logged_at)
  values (p_id, p_global_day, p_weight_kg, p_logged_at)
  on conflict (user_id, global_day) do update
  set weight_kg = excluded.weight_kg,
      logged_at = excluded.logged_at
  where w.logged_at <= excluded.logged_at;
end;
$$;

create function public.sync_food_log(p_id uuid, p_log_date date, p_name text, p_calories integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.food_logs (id, log_date, name, calories)
  values (p_id, p_log_date, p_name, p_calories)
  on conflict (id) do update
  set log_date = excluded.log_date,
      name = excluded.name,
      calories = excluded.calories;
$$;

revoke all on function private.open_session_id(integer) from public, anon, authenticated;
grant execute on function private.open_session_id(integer) to authenticated;

revoke all on function public.sync_start_session(uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_exercise_log(integer, text, integer, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_cardio_log(integer, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_weight_log(uuid, integer, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_food_log(uuid, date, text, integer) from public, anon, authenticated;

grant execute on function public.sync_start_session(uuid, integer, timestamptz) to authenticated;
grant execute on function public.sync_exercise_log(integer, text, integer, text, text, integer, timestamptz) to authenticated;
grant execute on function public.sync_cardio_log(integer, integer, integer, timestamptz) to authenticated;
grant execute on function public.sync_weight_log(uuid, integer, numeric, timestamptz) to authenticated;
grant execute on function public.sync_food_log(uuid, date, text, integer) to authenticated;
