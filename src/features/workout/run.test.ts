import { PROGRAM } from '../../data/program';
import { buildSteps, dayTitle, programDayFor } from './plan';
import { completeStep, createRun, currentStep, isRunComplete, summarizeRun, type Run } from './run';

const RESTS = { betweenSets: 45, betweenExercises: 60 };
const T0 = Date.UTC(2026, 9, 30);

const newRun = (globalDay: number) =>
  createRun({
    globalDay,
    sessionId: '11111111-1111-4111-8111-111111111111',
    startedAt: new Date(T0).toISOString(),
    rests: RESTS,
    now: T0,
  });

/** Recorre el día entero, tardando `secondsPerStep` en cada paso. */
const playToSummary = (start: Run, secondsPerStep = 10) => {
  let run = start;
  let now = T0;
  while (currentStep(run).kind !== 'summary') {
    now += secondsPerStep * 1000;
    run = completeStep(run, now).run;
  }
  return run;
};

describe('secuencia de pasos', () => {
  it('Fuerza A + Cardio: 3 series por ejercicio, descansos y cardio al final', () => {
    const steps = buildSteps(programDayFor(1));
    expect(steps.filter((step) => step.kind === 'set')).toHaveLength(18);
    expect(steps.filter((step) => step.kind === 'rest' && step.rest === 'set')).toHaveLength(12);
    expect(steps.filter((step) => step.kind === 'rest' && step.rest === 'exercise')).toHaveLength(
      6,
    );
    expect(steps.at(-2)).toEqual({ kind: 'cardio', minutes: 15 });
    expect(steps.at(-1)).toEqual({ kind: 'summary' });
  });

  it('sigue el orden serie → descanso → serie → descanso → serie → siguiente ejercicio', () => {
    const kinds = buildSteps(programDayFor(1))
      .slice(0, 7)
      .map((step) => (step.kind === 'rest' ? `rest:${step.rest}` : step.kind));
    expect(kinds).toEqual(['set', 'rest:set', 'set', 'rest:set', 'set', 'rest:exercise', 'set']);
  });

  it('un día solo de fuerza termina sin descanso final', () => {
    const steps = buildSteps(programDayFor(10));
    expect(steps.at(-2)?.kind).toBe('set');
  });

  it('un día de cardio es un único paso', () => {
    expect(buildSteps(programDayFor(2))).toEqual([
      { kind: 'cardio', minutes: 20 },
      { kind: 'summary' },
    ]);
  });

  it('la plancha lateral tiene lado izquierdo y derecho en cada serie', () => {
    const sides = buildSteps(programDayFor(3)).flatMap((step) =>
      step.kind === 'set' && step.exercise.key === 'side_plank'
        ? [`${step.setNumber}:${step.side}`]
        : [],
    );
    expect(sides).toEqual(['1:left', '1:right', '2:left', '2:right', '3:left', '3:right']);
  });

  it('resuelve el día del programa con el ciclo continuo', () => {
    expect(dayTitle(programDayFor(32))).toBe('Fuerza A + Cardio 15 min');
    expect(programDayFor(38).requiresWeighIn).toBe(true);
    expect(programDayFor(31).requiresWeighIn).toBe(false);
  });

  it.each(PROGRAM.map((day) => day.cycleDay))('el día %i genera una secuencia válida', (day) => {
    expect(buildSteps(programDayFor(day)).at(-1)).toEqual({ kind: 'summary' });
  });
});

describe('avance del día', () => {
  it('registra la duración real de cada serie', () => {
    const { run, operations } = completeStep(newRun(1), T0 + 32_400);
    expect(operations).toEqual([
      {
        type: 'exercise_log',
        globalDay: 1,
        exerciseKey: 'squat',
        setNumber: 1,
        side: null,
        target: '15 reps',
        durationSeconds: 32,
        completedAt: new Date(T0 + 32_400).toISOString(),
      },
    ]);
    expect(currentStep(run)).toMatchObject({ kind: 'rest', rest: 'set' });
    expect(run.timer.durationMs).toBe(45_000);
  });

  it('usa el descanso configurado entre ejercicios', () => {
    let run = newRun(1);
    for (let index = 0; index < 5; index += 1) run = completeStep(run, T0 + index).run;
    expect(currentStep(run)).toMatchObject({ kind: 'rest', rest: 'exercise' });
    expect(run.timer.durationMs).toBe(60_000);
  });

  it('un descanso no genera registros', () => {
    const afterSet = completeStep(newRun(1), T0 + 1000).run;
    expect(completeStep(afterSet, T0 + 2000).operations).toEqual([]);
  });

  it('terminar antes el cardio guarda el tiempo real', () => {
    const { operations } = completeStep(newRun(2), T0 + 300_000);
    expect(operations[0]).toMatchObject({
      type: 'cardio_log',
      targetMinutes: 20,
      actualSeconds: 300,
    });
  });

  it('una serie olvidada no supera el límite de la base de datos', () => {
    const { operations } = completeStep(newRun(1), T0 + 86_400_000);
    expect(operations[0]).toMatchObject({ durationSeconds: 7200 });
  });

  it('el resumen suma las series de cada ejercicio y el cardio', () => {
    const run = playToSummary(newRun(1));
    expect(isRunComplete(run)).toBe(true);
    const summary = summarizeRun(run);
    expect(summary.exercises).toHaveLength(6);
    expect(summary.exercises[0]).toMatchObject({ name: 'Sentadillas', seconds: 30 });
    expect(summary.cardioSeconds).toBe(10);
    expect(summary.totalSeconds).toBe(190);
  });

  it('continúa los registros de otro dispositivo en el primer paso pendiente', () => {
    const played = playToSummary(newRun(1));
    const run = createRun({
      globalDay: 1,
      sessionId: played.sessionId,
      startedAt: played.startedAt,
      rests: RESTS,
      setLogs: played.setLogs.slice(0, 4),
      now: T0,
    });
    expect(currentStep(run)).toMatchObject({
      kind: 'set',
      setNumber: 2,
      exercise: { key: 'pushup' },
    });
  });

  it('un día sin terminar no está completo', () => {
    expect(isRunComplete(newRun(1))).toBe(false);
  });
});
