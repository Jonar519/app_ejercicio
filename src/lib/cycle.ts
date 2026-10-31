export const CYCLE_LENGTH = 31;

export const cycleDay = (globalDay: number) => ((globalDay - 1) % CYCLE_LENGTH) + 1;

export const cycleNumber = (globalDay: number) => Math.floor((globalDay - 1) / CYCLE_LENGTH) + 1;

export const isCycleStart = (globalDay: number) => globalDay > 1 && cycleDay(globalDay) === 1;
