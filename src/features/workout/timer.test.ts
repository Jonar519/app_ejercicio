import {
  adjustCountdown,
  elapsedMs,
  isFinished,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startCountdown,
  startStopwatch,
  toWholeSeconds,
} from './timer';

const T0 = 1_000_000;

describe('cronómetro', () => {
  it('mide desde la marca de inicio', () => {
    expect(elapsedMs(startStopwatch(T0), T0 + 12_400)).toBe(12_400);
  });

  it('sigue siendo exacto tras una suspensión sin ticks', () => {
    expect(toWholeSeconds(elapsedMs(startStopwatch(T0), T0 + 3_600_000))).toBe(3600);
  });

  it('no da tiempos negativos si el reloj retrocede', () => {
    expect(elapsedMs(startStopwatch(T0), T0 - 5000)).toBe(0);
  });
});

describe('cuenta atrás', () => {
  it('calcula el tiempo restante tras una suspensión', () => {
    const timer = startCountdown(45_000, T0);
    expect(remainingMs(timer, T0 + 30_000)).toBe(15_000);
    expect(isFinished(timer, T0 + 44_999)).toBe(false);
    expect(isFinished(timer, T0 + 600_000)).toBe(true);
  });

  it('no registra más tiempo que el objetivo', () => {
    expect(elapsedMs(startCountdown(45_000, T0), T0 + 600_000)).toBe(45_000);
  });

  it('un cronómetro libre nunca termina', () => {
    expect(isFinished(startStopwatch(T0), T0 + 10_000_000)).toBe(false);
  });
});

describe('pausa y reanudación', () => {
  it('congela el tiempo durante la pausa', () => {
    const paused = pauseTimer(startCountdown(60_000, T0), T0 + 10_000);
    expect(remainingMs(paused, T0 + 500_000)).toBe(50_000);
    const resumed = resumeTimer(paused, T0 + 500_000);
    expect(remainingMs(resumed, T0 + 505_000)).toBe(45_000);
  });

  it('pausar dos veces o reanudar sin pausa no cambia nada', () => {
    const running = startCountdown(60_000, T0);
    expect(resumeTimer(running, T0 + 1000)).toBe(running);
    const paused = pauseTimer(running, T0 + 1000);
    expect(pauseTimer(paused, T0 + 2000)).toBe(paused);
  });
});

describe('ajuste de descanso', () => {
  it('suma y resta 15 s', () => {
    const timer = startCountdown(45_000, T0);
    expect(remainingMs(adjustCountdown(timer, 15_000, T0), T0)).toBe(60_000);
    expect(remainingMs(adjustCountdown(timer, -15_000, T0), T0)).toBe(30_000);
  });

  it('recortar más de lo que queda termina el descanso', () => {
    const timer = adjustCountdown(startCountdown(45_000, T0), -15_000, T0 + 40_000);
    expect(remainingMs(timer, T0 + 40_000)).toBe(0);
    expect(isFinished(timer, T0 + 40_000)).toBe(true);
  });

  it('no afecta a un cronómetro libre', () => {
    const timer = startStopwatch(T0);
    expect(adjustCountdown(timer, 15_000, T0)).toBe(timer);
  });
});
