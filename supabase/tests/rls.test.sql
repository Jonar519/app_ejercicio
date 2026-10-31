-- Aislamiento entre usuarios y denegación a anon en todas las tablas.
begin;
set local search_path = public, extensions;

select plan(67);

select tests.create_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Datos del usuario A
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into workout_sessions (id, global_day) values ('11111111-1111-4111-8111-111111111111', 1);
insert into exercise_logs (id, session_id, exercise_key, set_number, target, duration_seconds)
  values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'squat', 1, '15 reps', 30);
insert into cardio_logs (id, session_id, target_minutes, actual_seconds)
  values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 15, 900);
insert into weight_logs (id, global_day, weight_kg) values ('44444444-4444-4444-8444-444444444444', 1, 80);
insert into food_logs (id, log_date, name, calories) values ('55555555-5555-4555-8555-555555555555', '2026-10-30', 'Arroz', 300);
select tests.as_admin();

-- Configuración global
select is_empty($$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$, 'todas las tablas tienen RLS');
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity $$,
  'todas las tablas fuerzan RLS'
);
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'), 8, 'el esquema public tiene las 8 tablas esperadas'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public'
     and (coalesce(qual, '') in ('true', '(true)') or coalesce(with_check, '') in ('true', '(true)')) $$,
  'ninguna política es permisiva'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE') and with_check is null $$,
  'insert y update tienen with check'
);
select is_empty(
  $$ select table_name from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'PUBLIC') $$,
  'anon y public no tienen privilegios sobre tablas'
);
select is_empty(
  $$ select table_name from information_schema.column_privileges
     where table_schema = 'public' and grantee in ('anon', 'PUBLIC') $$,
  'anon y public no tienen privilegios sobre columnas'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and (has_function_privilege('anon', p.oid, 'execute')) $$,
  'anon no puede ejecutar funciones propias'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=""') $$,
  'las funciones security definer fijan search_path vacío'
);

-- anon no accede a nada
select tests.as_anon();
select throws_ok(format('select * from public.%I', t), '42501', null, 'anon no lee ' || t)
from unnest(array['profiles', 'user_settings', 'user_progress', 'workout_sessions', 'exercise_logs', 'cardio_logs', 'weight_logs', 'food_logs']) t;
select throws_ok($$ insert into public.food_logs (log_date, name, calories, user_id) values ('2026-10-30', 'x', 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$, '42501', null, 'anon no inserta');
select throws_ok($$ update public.food_logs set name = 'x' $$, '42501', null, 'anon no actualiza');
select throws_ok($$ delete from public.food_logs $$, '42501', null, 'anon no borra');
select throws_ok($$ select public.complete_day(1) $$, '42501', null, 'anon no ejecuta complete_day');
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anon no exporta');
select throws_ok($$ select public.delete_my_account('ELIMINAR') $$, '42501', null, 'anon no elimina cuentas');

-- B no lee a A
select tests.as_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is_empty($$ select 1 from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$, 'B no lee profiles de A');
select is_empty(format('select 1 from public.%I where user_id = %L', t, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'B no lee ' || t || ' de A')
from unnest(array['user_settings', 'user_progress', 'workout_sessions', 'exercise_logs', 'cardio_logs', 'weight_logs', 'food_logs']) t;
select is((select count(*)::int from profiles), 1, 'B solo ve su propio perfil');

-- B no inserta a nombre de A
select throws_ok($$ insert into workout_sessions (global_day, user_id) values (1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$, '42501', null, 'B no crea sesiones de A');
select throws_ok($$ insert into exercise_logs (session_id, user_id, exercise_key, set_number, target, duration_seconds) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pushup', 1, 't', 1) $$, '42501', null, 'B no crea exercise_logs de A');
select throws_ok($$ insert into exercise_logs (session_id, exercise_key, set_number, target, duration_seconds) values ('11111111-1111-4111-8111-111111111111', 'pushup', 1, 't', 1) $$, '42501', null, 'B no cuelga logs de la sesión de A');
select throws_ok($$ insert into cardio_logs (session_id, user_id, target_minutes, actual_seconds) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 15, 1) $$, '42501', null, 'B no crea cardio_logs de A');
select throws_ok($$ insert into weight_logs (user_id, global_day, weight_kg) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, 70) $$, '42501', null, 'B no crea weight_logs de A');
select throws_ok($$ insert into food_logs (user_id, log_date, name, calories) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-10-30', 'x', 1) $$, '42501', null, 'B no crea food_logs de A');
select throws_ok($$ insert into profiles (id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$, '42501', null, 'nadie inserta perfiles directamente');
select throws_ok($$ insert into user_settings (user_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$, '42501', null, 'nadie inserta preferencias directamente');
select throws_ok($$ insert into user_progress (user_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$, '42501', null, 'nadie inserta progreso directamente');

-- B no actualiza a A
select is_empty($$ update profiles set display_name = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza profiles de A');
select is_empty($$ update user_settings set daily_calorie_goal = 1 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza user_settings de A');
select is_empty($$ update workout_sessions set started_at = now() where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza workout_sessions de A');
select is_empty($$ update exercise_logs set duration_seconds = 1 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza exercise_logs de A');
select is_empty($$ update cardio_logs set actual_seconds = 1 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza cardio_logs de A');
select is_empty($$ update weight_logs set weight_kg = 21 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza weight_logs de A');
select is_empty($$ update food_logs set name = 'x' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no actualiza food_logs de A');

-- B no borra a A
select is_empty($$ delete from workout_sessions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no borra workout_sessions de A');
select is_empty($$ delete from exercise_logs where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no borra exercise_logs de A');
select is_empty($$ delete from cardio_logs where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no borra cardio_logs de A');
select is_empty($$ delete from weight_logs where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no borra weight_logs de A');
select is_empty($$ delete from food_logs where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$, 'B no borra food_logs de A');
select throws_ok($$ delete from profiles $$, '42501', null, 'nadie borra perfiles directamente');
select throws_ok($$ delete from user_settings $$, '42501', null, 'nadie borra preferencias directamente');
select throws_ok($$ delete from user_progress $$, '42501', null, 'nadie borra progreso directamente');

-- Un usuario no se concede progreso ni cierra días por su cuenta
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select throws_ok($$ update user_progress set global_day = 99 $$, '42501', null, 'no se puede saltar de día');
select throws_ok($$ update workout_sessions set status = 'completed', completed_at = now() $$, '42501', null, 'no se cierra una sesión sin complete_day');
select throws_ok($$ insert into workout_sessions (global_day) values (5) $$, '42501', null, 'no se abre una sesión de un día futuro');
select throws_ok($$ update workout_sessions set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, '42501', null, 'no se mueve una sesión a otro usuario');
select throws_ok($$ update food_logs set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, '42501', null, 'no se mueve un alimento a otro usuario');

-- Storage
select tests.as_admin();
select is(
  (select array[public::text, file_size_limit::text] from storage.buckets where id = 'avatars'),
  array['false', '524288'], 'el bucket avatars es privado y limita el tamaño'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png', 'image/webp'], 'el bucket avatars limita los tipos'
);
select tests.as_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.webp') $$, 'A sube a su carpeta');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/a.webp') $$, '42501', null, 'A no sube a la carpeta de B');
select tests.as_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is_empty($$ select 1 from storage.objects where bucket_id = 'avatars' $$, 'B no ve los archivos de A');
select is_empty($$ delete from storage.objects where bucket_id = 'avatars' returning 1 $$, 'B no borra los archivos de A');

select tests.as_admin();
select * from finish();
rollback;
