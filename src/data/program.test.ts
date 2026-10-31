import migration from '../../supabase/migrations/20261030000300_program.sql?raw';
import { PROGRAM, ROUTINES, type ProgramDay } from './program';
import programJson from './program.json';

/** Tabla de la especificación: [routine, cardioMinutes, requiresWeighIn] por día. */
const CALENDAR: [ProgramDay['routine'], number | undefined, boolean][] = [
  ['A', 15, false],
  [undefined, 20, false],
  ['B', 15, false],
  [undefined, 30, false],
  ['A', 15, false],
  [undefined, 40, false],
  [undefined, undefined, true],
  ['B', 20, false],
  [undefined, 35, false],
  ['A', undefined, false],
  [undefined, 35, false],
  ['B', 20, false],
  [undefined, 45, false],
  [undefined, undefined, true],
  ['A', 25, false],
  [undefined, 40, false],
  ['B', undefined, false],
  [undefined, 40, false],
  ['A', 25, false],
  [undefined, 50, false],
  [undefined, undefined, true],
  ['B', 25, false],
  [undefined, 45, false],
  ['A', undefined, false],
  [undefined, 45, false],
  ['B', 30, false],
  [undefined, 60, false],
  [undefined, undefined, true],
  ['A', 20, false],
  [undefined, 45, false],
  [undefined, undefined, false],
];

describe('datos del programa', () => {
  it('tiene exactamente 31 días consecutivos', () => {
    expect(PROGRAM.map((day) => day.cycleDay)).toEqual(
      Array.from({ length: 31 }, (_, index) => index + 1),
    );
  });

  it('coincide día a día con el calendario', () => {
    PROGRAM.forEach((day, index) => {
      const [routine, cardioMinutes, requiresWeighIn] = CALENDAR[index] ?? [];
      expect(day.routine).toBe(routine);
      expect(day.cardioMinutes).toBe(cardioMinutes);
      expect(day.requiresWeighIn).toBe(requiresWeighIn);
    });
  });

  it('el tipo de día es coherente con su contenido', () => {
    for (const day of PROGRAM) {
      const expected = day.routine
        ? day.cardioMinutes
          ? 'strength_cardio'
          : 'strength'
        : day.cardioMinutes
          ? 'cardio'
          : 'active_rest';
      expect(day.type).toBe(expected);
    }
  });

  it('exige pesaje solo en los días 7, 14, 21 y 28', () => {
    expect(PROGRAM.filter((day) => day.requiresWeighIn).map((day) => day.cycleDay)).toEqual([
      7, 14, 21, 28,
    ]);
  });

  it('cada rutina tiene 6 ejercicios con las claves especificadas', () => {
    expect(ROUTINES.A.map((exercise) => exercise.key)).toEqual([
      'squat',
      'pushup',
      'lunge',
      'glute_bridge',
      'calf_raise',
      'plank',
    ]);
    expect(ROUTINES.B.map((exercise) => exercise.key)).toEqual([
      'squat',
      'pushup',
      'reverse_lunge',
      'chair_dip',
      'leg_raise',
      'side_plank',
    ]);
  });

  it('program.json está sincronizado con program.ts', () => {
    expect(programJson).toEqual(JSON.parse(JSON.stringify({ ROUTINES, PROGRAM })));
  });

  it('la copia del calendario en SQL coincide con program.ts', () => {
    const sqlDays = [
      ...migration.matchAll(
        /^\s*\((\d+), '(\w+)', (?:'([AB])'|null), (\d+|null), (true|false)\)/gm,
      ),
    ].map(([, cycleDay, type, routine, cardioMinutes, requiresWeighIn]) => ({
      cycleDay: Number(cycleDay),
      type,
      ...(routine ? { routine } : {}),
      ...(cardioMinutes && cardioMinutes !== 'null'
        ? { cardioMinutes: Number(cardioMinutes) }
        : {}),
      requiresWeighIn: requiresWeighIn === 'true',
    }));
    expect(sqlDays).toEqual(PROGRAM);

    const sqlExercises = [...migration.matchAll(/^\s*\('([AB])', '(\w+)', (true|false)\)/gm)].map(
      ([, routine, key, perSide]) => [routine, key, perSide === 'true'],
    );
    expect(sqlExercises).toEqual(
      (['A', 'B'] as const).flatMap((routine) =>
        ROUTINES[routine].map((exercise) => [
          routine,
          exercise.key,
          exercise.target.kind === 'time_per_side',
        ]),
      ),
    );
  });
});
