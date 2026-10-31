-- Alta de usuario. SECURITY DEFINER: la dispara supabase_auth_admin, sin permisos sobre public.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 50));
  insert into public.user_settings (user_id) values (new.id);
  insert into public.user_progress (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Cierra el día activo. SECURITY DEFINER: authenticated no puede escribir global_day, status ni
-- completed_at. Es atómica (bloquea user_progress) e idempotente: repetir un día ya cerrado devuelve
-- el global_day actual sin avanzar.
create function public.complete_day(p_global_day integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_day integer;
  v_session public.workout_sessions%rowtype;
  v_day private.program_days%rowtype;
  v_missing_sets integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.global_day into v_current_day
  from public.user_progress p
  where p.user_id = v_user_id
  for update;

  if not found then
    raise exception 'progress_not_found';
  end if;

  if p_global_day < v_current_day and exists (
    select 1 from public.workout_sessions s
    where s.user_id = v_user_id and s.global_day = p_global_day and s.status = 'completed'
  ) then
    return v_current_day;
  end if;

  if p_global_day is distinct from v_current_day then
    raise exception 'day_mismatch';
  end if;

  select s.* into v_session
  from public.workout_sessions s
  where s.user_id = v_user_id and s.global_day = p_global_day;

  if not found then
    raise exception 'session_not_found';
  end if;

  select d.* into strict v_day
  from private.program_days d
  where d.cycle_day = v_session.cycle_day;

  if v_day.requires_weigh_in and not exists (
    select 1 from public.weight_logs w
    where w.user_id = v_user_id and w.global_day = p_global_day
  ) then
    raise exception 'weigh_in_required';
  end if;

  select count(*) into v_missing_sets
  from private.program_exercises e
  cross join generate_series(1, 3) as series (set_number)
  cross join lateral unnest(
    case when e.per_side then array['left', 'right'] else array[null::text] end
  ) as sides (side)
  where e.routine = v_day.routine
    and not exists (
      select 1 from public.exercise_logs l
      where l.session_id = v_session.id
        and l.exercise_key = e.exercise_key
        and l.set_number = series.set_number
        and l.side is not distinct from sides.side
    );

  if v_missing_sets > 0 then
    raise exception 'steps_incomplete';
  end if;

  if v_day.cardio_minutes is not null and not exists (
    select 1 from public.cardio_logs c where c.session_id = v_session.id
  ) then
    raise exception 'steps_incomplete';
  end if;

  update public.workout_sessions s
  set status = 'completed',
      completed_at = now(),
      total_seconds = (
        select coalesce(sum(l.duration_seconds), 0) from public.exercise_logs l where l.session_id = v_session.id
      ) + (
        select coalesce(sum(c.actual_seconds), 0) from public.cardio_logs c where c.session_id = v_session.id
      )
  where s.id = v_session.id;

  update public.user_progress p
  set global_day = v_current_day + 1
  where p.user_id = v_user_id;

  return v_current_day + 1;
end;
$$;

revoke all on function public.complete_day(integer) from public, anon, authenticated;
grant execute on function public.complete_day(integer) to authenticated;

-- Exportación de datos. SECURITY INVOKER: RLS limita el resultado al propio usuario.
create function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(t) from public.profiles t),
    'settings', (select to_jsonb(t) from public.user_settings t),
    'progress', (select to_jsonb(t) from public.user_progress t),
    'workout_sessions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.global_day), '[]') from public.workout_sessions t),
    'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.completed_at), '[]') from public.exercise_logs t),
    'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.completed_at), '[]') from public.cardio_logs t),
    'weight_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.global_day), '[]') from public.weight_logs t),
    'food_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.log_date, t.created_at), '[]') from public.food_logs t)
  );
$$;

revoke all on function public.export_my_data() from public, anon, authenticated;
grant execute on function public.export_my_data() to authenticated;

-- Eliminación de cuenta. SECURITY DEFINER: authenticated no tiene permisos sobre auth.users.
-- Todas las tablas cuelgan de auth.users con ON DELETE CASCADE. Storage prohíbe borrar objetos por
-- SQL, así que el cliente debe eliminar los archivos de avatars con la API antes de llamar aquí.
create function public.delete_my_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_confirmation is distinct from 'ELIMINAR' then
    raise exception 'confirmation_required';
  end if;

  delete from auth.users u where u.id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon, authenticated;
grant execute on function public.delete_my_account(text) to authenticated;
