-- Copia del calendario de src/data/program.ts para que el servidor valide sin confiar en el cliente.
-- src/data/program.test.ts comprueba que ambas copias coinciden.

create table private.program_days (
  cycle_day integer primary key check (cycle_day between 1 and 31),
  day_type text not null,
  routine text,
  cardio_minutes integer,
  requires_weigh_in boolean not null
);

create table private.program_exercises (
  routine text not null,
  exercise_key text not null,
  per_side boolean not null,
  primary key (routine, exercise_key)
);

insert into private.program_days (cycle_day, day_type, routine, cardio_minutes, requires_weigh_in) values
  (1, 'strength_cardio', 'A', 15, false),
  (2, 'cardio', null, 20, false),
  (3, 'strength_cardio', 'B', 15, false),
  (4, 'cardio', null, 30, false),
  (5, 'strength_cardio', 'A', 15, false),
  (6, 'cardio', null, 40, false),
  (7, 'active_rest', null, null, true),
  (8, 'strength_cardio', 'B', 20, false),
  (9, 'cardio', null, 35, false),
  (10, 'strength', 'A', null, false),
  (11, 'cardio', null, 35, false),
  (12, 'strength_cardio', 'B', 20, false),
  (13, 'cardio', null, 45, false),
  (14, 'active_rest', null, null, true),
  (15, 'strength_cardio', 'A', 25, false),
  (16, 'cardio', null, 40, false),
  (17, 'strength', 'B', null, false),
  (18, 'cardio', null, 40, false),
  (19, 'strength_cardio', 'A', 25, false),
  (20, 'cardio', null, 50, false),
  (21, 'active_rest', null, null, true),
  (22, 'strength_cardio', 'B', 25, false),
  (23, 'cardio', null, 45, false),
  (24, 'strength', 'A', null, false),
  (25, 'cardio', null, 45, false),
  (26, 'strength_cardio', 'B', 30, false),
  (27, 'cardio', null, 60, false),
  (28, 'active_rest', null, null, true),
  (29, 'strength_cardio', 'A', 20, false),
  (30, 'cardio', null, 45, false),
  (31, 'active_rest', null, null, false);

insert into private.program_exercises (routine, exercise_key, per_side) values
  ('A', 'squat', false),
  ('A', 'pushup', false),
  ('A', 'lunge', false),
  ('A', 'glute_bridge', false),
  ('A', 'calf_raise', false),
  ('A', 'plank', false),
  ('B', 'squat', false),
  ('B', 'pushup', false),
  ('B', 'reverse_lunge', false),
  ('B', 'chair_dip', false),
  ('B', 'leg_raise', false),
  ('B', 'side_plank', true);

revoke all on private.program_days, private.program_exercises from public, anon;
grant select on private.program_days, private.program_exercises to authenticated;

-- day_type y routine los decide el servidor a partir de global_day.
create function private.set_session_program()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select d.day_type, d.routine into strict new.day_type, new.routine
  from private.program_days d
  where d.cycle_day = ((new.global_day - 1) % 31) + 1;
  return new;
end;
$$;

create trigger workout_sessions_set_program before insert on public.workout_sessions
  for each row execute function private.set_session_program();

revoke all on function private.touch_updated_at(), private.set_session_program() from public, anon, authenticated;
