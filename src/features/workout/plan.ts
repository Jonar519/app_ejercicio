import {
  PROGRAM,
  ROUTINES,
  SETS_PER_EXERCISE,
  type Exercise,
  type ProgramDay,
} from '../../data/program';
import { cycleDay } from '../../lib/cycle';
import type { Side } from '../../lib/offline/queue';

export type RestKind = 'set' | 'exercise';

export type Step =
  | { kind: 'set'; exercise: Exercise; exerciseIndex: number; setNumber: number; side: Side | null }
  | { kind: 'rest'; rest: RestKind; nextLabel: string }
  | { kind: 'cardio'; minutes: number }
  | { kind: 'summary' };

export const programDayFor = (globalDay: number): ProgramDay => {
  const day = PROGRAM[cycleDay(globalDay) - 1];
  if (!day) throw new Error('Día del programa inexistente');
  return day;
};

export const dayTitle = (day: ProgramDay) => {
  const cardio = `Cardio ${day.cardioMinutes} min`;
  switch (day.type) {
    case 'strength_cardio':
      return `Fuerza ${day.routine} + ${cardio}`;
    case 'strength':
      return `Fuerza ${day.routine}`;
    case 'cardio':
      return cardio;
    case 'active_rest':
      return 'Descanso activo';
  }
};

export const dayExercises = (day: ProgramDay): readonly Exercise[] =>
  day.routine ? ROUTINES[day.routine] : [];

export const formatTarget = ({ target }: Exercise) => {
  switch (target.kind) {
    case 'reps':
      return `${target.reps} reps`;
    case 'reps_per_leg':
      return `${target.reps} reps por pierna`;
    case 'time':
      return `${target.seconds} segundos`;
    case 'time_per_side':
      return `${target.seconds} segundos por lado`;
  }
};

/** Segundos de la cuenta atrás de un ejercicio por tiempo; null si usa cronómetro libre. */
export const targetSeconds = ({ target }: Exercise) =>
  target.kind === 'time' || target.kind === 'time_per_side' ? target.seconds : null;

const sidesOf = ({ target }: Exercise): (Side | null)[] =>
  target.kind === 'time_per_side' ? ['left', 'right'] : [null];

/** Secuencia completa de un día con ejercicios o cardio; termina siempre en el resumen. */
export const buildSteps = (day: ProgramDay): Step[] => {
  const steps: Step[] = [];
  const exercises = dayExercises(day);
  const hasCardio = day.cardioMinutes !== undefined;

  exercises.forEach((exercise, exerciseIndex) => {
    for (let setNumber = 1; setNumber <= SETS_PER_EXERCISE; setNumber += 1) {
      for (const side of sidesOf(exercise)) {
        steps.push({ kind: 'set', exercise, exerciseIndex, setNumber, side });
      }
      if (setNumber < SETS_PER_EXERCISE) {
        steps.push({
          kind: 'rest',
          rest: 'set',
          nextLabel: `Serie ${setNumber + 1} de ${SETS_PER_EXERCISE}`,
        });
      }
    }
    const next = exercises[exerciseIndex + 1];
    if (next) steps.push({ kind: 'rest', rest: 'exercise', nextLabel: next.name });
    else if (hasCardio) steps.push({ kind: 'rest', rest: 'exercise', nextLabel: 'Cardio' });
  });

  if (day.cardioMinutes !== undefined) steps.push({ kind: 'cardio', minutes: day.cardioMinutes });
  steps.push({ kind: 'summary' });
  return steps;
};
