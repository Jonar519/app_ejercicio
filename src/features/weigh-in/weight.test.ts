import type { QueueItem, SyncOperation } from '../../lib/offline/queue';
import { mergePendingWeights, parseWeightInput, withVariation, type WeightLog } from './weight';

const log = (globalDay: number, weightKg: number): WeightLog => ({
  id: crypto.randomUUID(),
  global_day: globalDay,
  cycle_day: globalDay,
  cycle_number: 1,
  weight_kg: weightKg,
  logged_at: '2026-10-30T10:00:00.000Z',
});

const queued = (operation: SyncOperation, failed = false): QueueItem => ({
  seq: 1,
  id: crypto.randomUUID(),
  operation,
  attempts: 0,
  nextAttemptAt: 0,
  failed,
});

const weightOperation = (globalDay: number, weightKg: number): SyncOperation => ({
  type: 'weight_log',
  id: crypto.randomUUID(),
  globalDay,
  weightKg,
  loggedAt: '2026-10-30T11:00:00.000Z',
});

describe('entrada de peso', () => {
  it('guarda kg tal cual', () => {
    expect(parseWeightInput('80,5', 'kg')).toEqual({ kg: 80.5 });
  });

  it('convierte lb a kg', () => {
    expect(parseWeightInput('180', 'lb')).toEqual({ kg: 81.65 });
  });

  it.each(['', 'abc', '19.9', '401'])('rechaza %j en kg', (value) => {
    expect(parseWeightInput(value, 'kg').error).toBeDefined();
  });

  it('valida el rango en kg aunque se escriba en lb', () => {
    expect(parseWeightInput('40', 'lb').error).toBe('Introduce un peso entre 44.1 y 881.8 lb');
    expect(parseWeightInput('50', 'lb').kg).toBe(22.68);
  });
});

describe('historial', () => {
  it('calcula la variación respecto al registro anterior', () => {
    const entries = withVariation([log(7, 80.5), log(14, 79.9), log(21, 80.2)]);
    expect(entries.map((entry) => entry.deltaKg)).toEqual([null, -0.6, 0.3]);
  });

  it('muestra los pesos aún sin sincronizar, con su ciclo', () => {
    const merged = mergePendingWeights([log(7, 80)], [queued(weightOperation(38, 79))]);
    expect(merged.map((entry) => entry.global_day)).toEqual([7, 38]);
    expect(merged[1]).toMatchObject({ cycle_day: 7, cycle_number: 2, weight_kg: 79 });
  });

  it('lo pendiente sustituye al registro del mismo día', () => {
    const merged = mergePendingWeights([log(7, 80)], [queued(weightOperation(7, 81))]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.weight_kg).toBe(81);
  });

  it('ignora lo rechazado por el servidor', () => {
    expect(mergePendingWeights([], [queued(weightOperation(7, 81), true)])).toEqual([]);
  });
});
