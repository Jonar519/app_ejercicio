export type DayType = 'strength_cardio' | 'strength' | 'cardio' | 'active_rest';
export type RoutineId = 'A' | 'B';

export type ExerciseTarget =
  | { kind: 'reps'; reps: number }
  | { kind: 'reps_per_leg'; reps: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'time_per_side'; seconds: number };

export interface Exercise {
  key: string;
  name: string;
  target: ExerciseTarget;
}

export interface ProgramDay {
  cycleDay: number;
  type: DayType;
  routine?: RoutineId;
  cardioMinutes?: number;
  requiresWeighIn: boolean;
}

export const SETS_PER_EXERCISE = 3;

const squat: Exercise = { key: 'squat', name: 'Sentadillas', target: { kind: 'reps', reps: 15 } };
const pushup: Exercise = { key: 'pushup', name: 'Flexiones', target: { kind: 'reps', reps: 15 } };

export const ROUTINES: Record<RoutineId, readonly Exercise[]> = {
  A: [
    squat,
    pushup,
    { key: 'lunge', name: 'Zancadas', target: { kind: 'reps_per_leg', reps: 10 } },
    { key: 'glute_bridge', name: 'Puente de glúteos', target: { kind: 'reps', reps: 15 } },
    { key: 'calf_raise', name: 'Elevaciones de pantorrilla', target: { kind: 'reps', reps: 20 } },
    { key: 'plank', name: 'Plancha', target: { kind: 'time', seconds: 45 } },
  ],
  B: [
    squat,
    pushup,
    {
      key: 'reverse_lunge',
      name: 'Zancadas hacia atrás',
      target: { kind: 'reps_per_leg', reps: 10 },
    },
    { key: 'chair_dip', name: 'Fondos en silla', target: { kind: 'reps', reps: 12 } },
    { key: 'leg_raise', name: 'Elevaciones de piernas', target: { kind: 'reps', reps: 15 } },
    { key: 'side_plank', name: 'Plancha lateral', target: { kind: 'time_per_side', seconds: 30 } },
  ],
};

const strength = (cycleDay: number, routine: RoutineId, cardioMinutes?: number): ProgramDay =>
  cardioMinutes === undefined
    ? { cycleDay, type: 'strength', routine, requiresWeighIn: false }
    : { cycleDay, type: 'strength_cardio', routine, cardioMinutes, requiresWeighIn: false };

const cardio = (cycleDay: number, cardioMinutes: number): ProgramDay => ({
  cycleDay,
  type: 'cardio',
  cardioMinutes,
  requiresWeighIn: false,
});

const rest = (cycleDay: number, requiresWeighIn: boolean): ProgramDay => ({
  cycleDay,
  type: 'active_rest',
  requiresWeighIn,
});

export const PROGRAM: readonly ProgramDay[] = [
  strength(1, 'A', 15),
  cardio(2, 20),
  strength(3, 'B', 15),
  cardio(4, 30),
  strength(5, 'A', 15),
  cardio(6, 40),
  rest(7, true),
  strength(8, 'B', 20),
  cardio(9, 35),
  strength(10, 'A'),
  cardio(11, 35),
  strength(12, 'B', 20),
  cardio(13, 45),
  rest(14, true),
  strength(15, 'A', 25),
  cardio(16, 40),
  strength(17, 'B'),
  cardio(18, 40),
  strength(19, 'A', 25),
  cardio(20, 50),
  rest(21, true),
  strength(22, 'B', 25),
  cardio(23, 45),
  strength(24, 'A'),
  cardio(25, 45),
  strength(26, 'B', 30),
  cardio(27, 60),
  rest(28, true),
  strength(29, 'A', 20),
  cardio(30, 45),
  rest(31, false),
];
