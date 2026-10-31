import { CYCLE_LENGTH, cycleDay, cycleNumber, isCycleStart } from './cycle';

describe('ciclo continuo', () => {
  it.each([
    [1, 1, 1],
    [31, 31, 1],
    [32, 1, 2],
    [33, 2, 2],
    [62, 31, 2],
    [63, 1, 3],
    [1000, 8, 33],
  ])('global_day %i → cycle_day %i, cycle_number %i', (globalDay, day, number) => {
    expect(cycleDay(globalDay)).toBe(day);
    expect(cycleNumber(globalDay)).toBe(number);
  });

  it('el pesaje cae en los días globales esperados', () => {
    const weighInDays = Array.from({ length: 69 }, (_, index) => index + 1).filter((globalDay) =>
      [7, 14, 21, 28].includes(cycleDay(globalDay)),
    );
    expect(weighInDays).toEqual([7, 14, 21, 28, 38, 45, 52, 59, 69]);
  });

  it('cycle_day siempre está entre 1 y la longitud del ciclo', () => {
    for (let globalDay = 1; globalDay <= 5000; globalDay += 1) {
      expect(cycleDay(globalDay)).toBeGreaterThanOrEqual(1);
      expect(cycleDay(globalDay)).toBeLessThanOrEqual(CYCLE_LENGTH);
    }
  });

  it('detecta el inicio de un ciclo nuevo, excepto el primero', () => {
    expect(isCycleStart(1)).toBe(false);
    expect(isCycleStart(31)).toBe(false);
    expect(isCycleStart(32)).toBe(true);
    expect(isCycleStart(63)).toBe(true);
  });
});
