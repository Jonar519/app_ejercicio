-- Reglas del día: alta de usuario, ciclo continuo, complete_day, restricciones y cuenta.
begin;
set local search_path = public, extensions;

select plan(39);

create function pg_temp.set_day(p_user uuid, p_day integer) returns void language sql as $$
  update public.user_progress set global_day = p_day where user_id = p_user;
$$;

-- Completa las series de fuerza que exige la rutina de la sesión.
create function pg_temp.log_all_sets(p_session uuid) returns void language sql as $$
  insert into public.exercise_logs (session_id, user_id, exercise_key, set_number, side, target, duration_seconds)
  select s.id, s.user_id, e.exercise_key, n, side, 't', 10
  from public.workout_sessions s
  join private.program_exercises e on e.routine = s.routine
  cross join generate_series(1, 3) n
  cross join lateral unnest(case when e.per_side then array['left', 'right'] else array[null::text] end) side
  where s.id = p_session;
$$;

select tests.create_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Alta
select is((select global_day from user_progress where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'un usuario nuevo empieza en el día 1');
select is((select count(*)::int from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'el trigger crea el perfil');
select is((select daily_calorie_goal from user_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2000, 'el trigger crea las preferencias');

-- Día 1: fuerza A + cardio
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select throws_ok('select complete_day(1)', 'P0001', 'session_not_found', 'exige que exista la sesión');
select throws_ok('select complete_day(2)', 'P0001', 'day_mismatch', 'rechaza un día futuro');
select throws_ok('select complete_day(0)', 'P0001', 'day_mismatch', 'rechaza un día inexistente');
insert into workout_sessions (id, global_day) values ('11111111-1111-4111-8111-111111111111', 1);
select results_eq(
  $$ select cycle_day, cycle_number, day_type, routine, status from workout_sessions $$,
  $$ values (1, 1, 'strength_cardio', 'A', 'in_progress') $$,
  'el servidor deriva el programa de la sesión'
);
select throws_ok('select complete_day(1)', 'P0001', 'steps_incomplete', 'exige las series de fuerza');
select pg_temp.log_all_sets('11111111-1111-4111-8111-111111111111');
select throws_ok('select complete_day(1)', 'P0001', 'steps_incomplete', 'exige el cardio');
insert into cardio_logs (session_id, target_minutes, actual_seconds) values ('11111111-1111-4111-8111-111111111111', 15, 600);
select is(complete_day(1), 2, 'complete_day avanza un día');
select is(complete_day(1), 2, 'complete_day es idempotente');
select is((select global_day from user_progress), 2, 'la repetición no avanza dos días');
select results_eq(
  $$ select status, total_seconds, completed_at is not null from workout_sessions where global_day = 1 $$,
  $$ values ('completed', 780, true) $$,
  'la sesión queda cerrada con el tiempo total del servidor'
);
select is_empty($$ update exercise_logs set duration_seconds = 1 returning 1 $$, 'una sesión cerrada no se puede modificar');
select is_empty($$ delete from exercise_logs returning 1 $$, 'los logs de una sesión cerrada no se borran');
select is_empty($$ delete from workout_sessions returning 1 $$, 'una sesión cerrada no se borra');
select throws_ok(
  $$ insert into cardio_logs (session_id, target_minutes, actual_seconds) values ('11111111-1111-4111-8111-111111111111', 15, 1) $$,
  '42501', null, 'una sesión cerrada no acepta logs'
);

-- Pesaje obligatorio en el día 7 y en el día global 38
select tests.as_admin();
select pg_temp.set_day('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7);
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into workout_sessions (global_day) values (7);
select throws_ok('select complete_day(7)', 'P0001', 'weigh_in_required', 'el día 7 exige pesaje');
insert into weight_logs (global_day, weight_kg) values (7, 80.5);
select is(complete_day(7), 8, 'el pesaje desbloquea el día 7');
select is_empty($$ update weight_logs set weight_kg = 79 returning 1 $$, 'el peso de un día cerrado no se modifica');

select tests.as_admin();
select pg_temp.set_day('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 38);
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into workout_sessions (global_day) values (38);
select throws_ok('select complete_day(38)', 'P0001', 'weigh_in_required', 'el día global 38 exige pesaje');
insert into weight_logs (global_day, weight_kg) values (38, 79.25);
select results_eq(
  $$ select cycle_day, cycle_number, weight_kg from weight_logs where global_day = 38 $$,
  $$ values (7, 2, 79.25::numeric(5,2)) $$,
  'el peso guarda el día y ciclo derivados'
);
select is(complete_day(38), 39, 'el pesaje desbloquea el día global 38');

-- Plancha lateral: dos lados por serie (día 17, fuerza B sin cardio)
select tests.as_admin();
select pg_temp.set_day('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 17);
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into workout_sessions (id, global_day) values ('66666666-6666-4666-8666-666666666666', 17);
select pg_temp.log_all_sets('66666666-6666-4666-8666-666666666666');
delete from exercise_logs where session_id = '66666666-6666-4666-8666-666666666666' and side = 'right' and set_number = 3;
select throws_ok('select complete_day(17)', 'P0001', 'steps_incomplete', 'cada serie de plancha lateral exige ambos lados');
insert into exercise_logs (session_id, exercise_key, set_number, side, target, duration_seconds)
  values ('66666666-6666-4666-8666-666666666666', 'side_plank', 3, 'right', '30 s', 30);
select is(complete_day(17), 18, 'con ambos lados se cierra el día');

-- Día 31 → 32: descanso sin pesaje y vuelta a la rutina del día 1
select tests.as_admin();
select pg_temp.set_day('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 31);
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into workout_sessions (global_day) values (31);
select is(complete_day(31), 32, 'el día 31 no exige pesaje y pasa al 32');
insert into workout_sessions (global_day) values (32);
select results_eq(
  $$ select cycle_day, cycle_number, day_type, routine from workout_sessions where global_day = 32 $$,
  $$ values (1, 2, 'strength_cardio', 'A') $$,
  'el día 32 es el día 1 del ciclo 2'
);

-- Restricciones
select throws_ok($$ insert into weight_logs (global_day, weight_kg) values (32, 19.99) $$, '23514', null, 'peso mínimo');
select throws_ok($$ insert into weight_logs (global_day, weight_kg) values (32, 400.01) $$, '23514', null, 'peso máximo');
select throws_ok($$ insert into food_logs (log_date, name, calories) values ('2026-10-30', 'x', -1) $$, '23514', null, 'calorías no negativas');
select throws_ok($$ insert into food_logs (log_date, name, calories) values ('2026-10-30', 'x', 20001) $$, '23514', null, 'tope de calorías');
select throws_ok($$ insert into food_logs (log_date, name, calories) values ('2026-10-30', repeat('x', 121), 1) $$, '23514', null, 'longitud del nombre del alimento');
select throws_ok($$ update profiles set display_name = repeat('x', 51) $$, '23514', null, 'longitud del nombre');

-- Exportación y borrado
insert into food_logs (log_date, name, calories) values ('2026-10-30', 'Avena', 150);
select is((export_my_data() #>> '{profile,id}'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'la exportación contiene el perfil propio');
select is(jsonb_array_length(export_my_data() -> 'food_logs'), 1, 'la exportación contiene los alimentos propios');
select throws_ok($$ select delete_my_account('no') $$, 'P0001', 'confirmation_required', 'el borrado exige confirmación');
select lives_ok($$ select delete_my_account('ELIMINAR') $$, 'el usuario elimina su cuenta');
select tests.as_admin();
select is(
  (select count(*)::int from food_logs) + (select count(*)::int from workout_sessions) + (select count(*)::int from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0, 'el borrado elimina todo en cascada'
);
select is((select count(*)::int from auth.users), 1, 'el borrado no afecta a otros usuarios');

select * from finish();
rollback;
