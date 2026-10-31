-- Escrituras de la cola offline: idempotencia, repetición tras cerrar un día y aislamiento.
begin;
set local search_path = public, extensions;

select plan(26);

select tests.create_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- Sesión
select throws_ok(
  $$ select sync_start_session(gen_random_uuid(), 2, now()) $$,
  'P0001', 'day_mismatch', 'no se abre un día futuro'
);
select lives_ok(
  $$ select sync_start_session('11111111-1111-4111-8111-111111111111', 1, now()) $$,
  'abre la sesión del día activo'
);
select lives_ok(
  $$ select sync_start_session('11111111-1111-4111-8111-111111111111', 1, now()) $$,
  'repetir la apertura no falla'
);
select lives_ok(
  $$ select sync_start_session('22222222-2222-4222-8222-222222222222', 1, now()) $$,
  'otro dispositivo no falla al abrir el mismo día'
);
select is((select count(*)::int from workout_sessions), 1, 'solo existe una sesión por día');
select is((select id from workout_sessions), '11111111-1111-4111-8111-111111111111'::uuid, 'se conserva la primera sesión');

-- Series
select lives_ok(
  $$ select sync_exercise_log(1, 'squat', 1, null, '15 reps', 30, '2026-10-30 10:00:00+00') $$,
  'registra una serie'
);
select lives_ok(
  $$ select sync_exercise_log(1, 'squat', 1, null, '15 reps', 30, '2026-10-30 10:00:00+00') $$,
  'repetir una serie no falla'
);
select is((select count(*)::int from exercise_logs), 1, 'la repetición no duplica la serie');
select lives_ok(
  $$ select sync_exercise_log(1, 'squat', 1, null, '15 reps', 99, '2026-10-30 09:00:00+00') $$,
  'una escritura antigua no falla'
);
select is((select duration_seconds from exercise_logs), 30, 'una escritura antigua no pisa la reciente');
select lives_ok(
  $$ select sync_exercise_log(1, 'squat', 1, null, '15 reps', 40, '2026-10-30 11:00:00+00') $$,
  'una escritura nueva no falla'
);
select is((select duration_seconds from exercise_logs), 40, 'gana la última escritura');
select throws_ok(
  $$ select sync_exercise_log(9, 'squat', 1, null, '15 reps', 30, now()) $$,
  'P0001', 'session_not_found', 'una serie exige su sesión'
);

-- Peso: día 7 con pesaje
select tests.as_admin();
update user_progress set global_day = 7 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select lives_ok(
  $$ select sync_weight_log('33333333-3333-4333-8333-333333333333', 7, 80.5, '2026-10-30 10:00:00+00') $$,
  'registra el peso'
);
select lives_ok(
  $$ select sync_weight_log('44444444-4444-4444-8444-444444444444', 7, 81, '2026-10-30 11:00:00+00') $$,
  'otro dispositivo corrige el peso del día'
);
select results_eq(
  $$ select count(*)::int, max(weight_kg) from weight_logs $$,
  $$ values (1, 81.00::numeric) $$,
  'un solo peso por día: gana el último'
);
select throws_ok(
  $$ select sync_weight_log(gen_random_uuid(), 8, 80, now()) $$,
  'P0001', 'day_mismatch', 'no registra peso en un día futuro'
);
select sync_start_session(gen_random_uuid(), 7, now());
select is(complete_day(7), 8, 'cierra el día con el peso sincronizado');

-- Repetición tras cerrar: la respuesta pudo perderse antes de vaciar la cola.
select lives_ok(
  $$ select sync_start_session(gen_random_uuid(), 7, now()) $$,
  'repetir la apertura de un día cerrado no falla'
);
select lives_ok(
  $$ select sync_weight_log(gen_random_uuid(), 7, 90, now()) $$,
  'repetir el peso de un día cerrado no falla'
);
select is((select weight_kg from weight_logs where global_day = 7), 81.00::numeric, 'un día cerrado no cambia');
select is(complete_day(7), 8, 'repetir complete_day no avanza');

-- Alimentos e aislamiento
select lives_ok(
  $$ select sync_food_log('55555555-5555-4555-8555-555555555555', '2026-10-30', 'Arroz', 300) $$,
  'registra un alimento'
);
select sync_food_log('55555555-5555-4555-8555-555555555555', '2026-10-30', 'Arroz con pollo', 450);
select results_eq(
  $$ select count(*)::int, max(calories) from food_logs $$,
  $$ values (1, 450) $$,
  'editar por el mismo id no duplica'
);
select tests.as_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select throws_ok(
  $$ select sync_food_log('55555555-5555-4555-8555-555555555555', '2026-10-30', 'Robado', 1) $$,
  '42501', null, 'B no puede pisar un alimento de A'
);

select tests.as_admin();
select * from finish();
rollback;
