import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { kvGet } from '../../lib/idb';
import { readQueue } from '../../lib/offline/queue';
import { useAuthStore } from '../auth/authStore';
import type { Settings } from '../profile/schemas';
import { RunnerPage } from './RunnerPage';
import { resetRunner, useRunnerStore } from './runnerStore';
import { TodayPage } from './TodayPage';
import type { Session } from '@supabase/supabase-js';
import type { Run } from './run';

vi.mock('../../lib/offline/sync', async () => {
  const { enqueue } = await import('../../lib/offline/queue');
  return {
    enqueueOperation: enqueue,
    useSyncStore: () => ({ online: true, syncing: false, pending: 0, failed: 0 }),
  };
});

const SETTINGS: Settings = {
  weight_unit: 'kg',
  daily_calorie_goal: 2000,
  rest_between_sets_seconds: 45,
  rest_between_exercises_seconds: 60,
  sound_enabled: false,
  vibration_enabled: false,
};

let serverDay = 1;

/** Servidor simulado: solo responde a las lecturas del día activo y las preferencias. */
vi.mock('../../lib/supabase', () => {
  const single = vi.fn();
  const chain = (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      abortSignal: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () =>
        table === 'user_progress'
          ? { data: { global_day: serverDay }, error: null }
          : { data: SETTINGS, error: null },
    };
    return query;
  };
  return { supabase: { from: chain, rpc: single } };
});

let userId: string;

const renderApp = (initialEntry = '/entrenamiento') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/entrenamiento" element={<TodayPage />} />
          <Route path="/entrenamiento/sesion" element={<RunnerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const click = (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  screen.findByRole('button', { name }).then((button) => user.click(button));

const start = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Comenzar' })).toBeEnabled());
  await click(user, 'Comenzar');
};

beforeEach(() => {
  userId = crypto.randomUUID();
  serverDay = 1;
  resetRunner();
  useAuthStore.setState({
    status: 'ready',
    session: { user: { id: userId } } as Session,
    recovery: false,
  });
});

describe('pantalla Hoy', () => {
  it('un usuario nuevo ve el día 1 con Fuerza A + Cardio 15 min', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Día 1' })).toBeInTheDocument();
    expect(screen.getByText('Ciclo 1 · Día 1 del programa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fuerza A + Cardio 15 min' })).toBeInTheDocument();
    expect(screen.getByText('Sentadillas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comenzar' })).toBeInTheDocument();
  });

  it('el día 32 muestra el ciclo 2 y la rutina del día 1', async () => {
    serverDay = 32;
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Día 32' })).toBeInTheDocument();
    expect(screen.getByText('Ciclo 2 · Día 1 del programa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fuerza A + Cardio 15 min' })).toBeInTheDocument();
  });
});

describe('runner', () => {
  it('avanza por series, descansos y ejercicios', async () => {
    const user = userEvent.setup();
    renderApp();
    await start(user);

    expect(await screen.findByText('Ejercicio 1 de 6 · Serie 1 de 3')).toBeInTheDocument();
    await click(user, 'Serie completada');
    expect(await screen.findByText('Descanso entre series')).toBeInTheDocument();
    await click(user, 'Saltar descanso');
    expect(await screen.findByText('Ejercicio 1 de 6 · Serie 2 de 3')).toBeInTheDocument();
    await click(user, 'Serie completada');
    await click(user, 'Saltar descanso');
    await click(user, 'Serie completada');
    expect(await screen.findByText('Descanso entre ejercicios')).toBeInTheDocument();
    await click(user, 'Saltar descanso');
    expect(await screen.findByText('Ejercicio 2 de 6 · Serie 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flexiones' })).toBeInTheDocument();

    await waitFor(async () => {
      const logs = (await readQueue(userId)).filter(
        (item) => item.operation.type === 'exercise_log',
      );
      expect(logs).toHaveLength(3);
    });
  });

  it('ajusta el descanso con ±15 s', async () => {
    const user = userEvent.setup();
    renderApp();
    await start(user);
    await click(user, 'Serie completada');
    await screen.findByText('Descanso entre series');
    await click(user, 'Sumar 15 segundos');
    expect(useRunnerStore.getState().run?.timer.durationMs).toBe(60_000);
    await click(user, 'Restar 15 segundos');
    expect(useRunnerStore.getState().run?.timer.durationMs).toBe(45_000);
  });

  it('muestra las repeticiones por pierna', async () => {
    const user = userEvent.setup();
    renderApp();
    await start(user);
    for (let step = 0; step < 12; step += 1) {
      await click(user, /Serie completada|Saltar descanso/);
    }
    expect(await screen.findByText('10 reps por pierna')).toBeInTheDocument();
  });

  it('al reabrir conserva el paso exacto y los tiempos', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await start(user);
    await click(user, 'Serie completada');
    await screen.findByText('Descanso entre series');
    await click(user, 'Saltar descanso');
    await screen.findByText('Ejercicio 1 de 6 · Serie 2 de 3');
    const before = useRunnerStore.getState().run;
    await waitFor(async () =>
      expect((await kvGet<Run>(userId, 'run'))?.stepIndex).toBe(before?.stepIndex),
    );

    unmount();
    resetRunner();
    renderApp('/entrenamiento/sesion');

    expect(await screen.findByText('Ejercicio 1 de 6 · Serie 2 de 3')).toBeInTheDocument();
    expect(useRunnerStore.getState().run).toEqual(before);
  });

  it('sin día en curso vuelve a Hoy', async () => {
    renderApp('/entrenamiento/sesion');
    expect(await screen.findByRole('heading', { name: 'Día 1' })).toBeInTheDocument();
  });

  it('el cardio se pausa y se reanuda', async () => {
    serverDay = 2;
    const user = userEvent.setup();
    renderApp();
    await start(user);
    await click(user, 'Pausar');
    expect(useRunnerStore.getState().run?.timer.runningSince).toBeNull();
    await click(user, 'Reanudar');
    expect(useRunnerStore.getState().run?.timer.runningSince).not.toBeNull();
    await click(user, 'Finalizar cardio');
    expect(await screen.findByRole('heading', { name: /Resumen del día 2/ })).toBeInTheDocument();
    expect(screen.getByText('Cardio')).toBeInTheDocument();
  });

  it('avanza solo cuando termina el descanso', async () => {
    const user = userEvent.setup();
    renderApp();
    await start(user);
    await click(user, 'Serie completada');
    await screen.findByText('Descanso entre series');
    const realNow = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(realNow + 46_000);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByText('Ejercicio 1 de 6 · Serie 2 de 3')).toBeInTheDocument();
    clock.mockRestore();
  });
});

describe('check-in', () => {
  it('cierra el día, celebra y avanza al siguiente', async () => {
    serverDay = 2;
    const user = userEvent.setup();
    renderApp();
    await start(user);
    await click(user, 'Finalizar cardio');
    await click(user, 'Finalizar día');

    expect(await screen.findByRole('heading', { name: '¡Día 2 completado!' })).toBeInTheDocument();
    await click(user, 'Continuar');
    expect(await screen.findByRole('heading', { name: 'Día 3' })).toBeInTheDocument();

    const operations = (await readQueue(userId)).map((item) => item.operation.type);
    expect(operations).toEqual(['session_start', 'cardio_log', 'complete_day']);
    expect(await kvGet(userId, 'run')).toBeUndefined();
  });

  it('un día de descanso sin pesaje se cierra con un botón', async () => {
    serverDay = 31;
    const user = userEvent.setup();
    renderApp();
    await click(user, 'Marcar descanso completado');
    expect(await screen.findByRole('heading', { name: '¡Día 31 completado!' })).toBeInTheDocument();
    const operations = (await readQueue(userId)).map((item) => item.operation.type);
    expect(operations).toEqual(['session_start', 'complete_day']);
  });

  it('al completar el día 31 pasa al día 32, ciclo 2, con la rutina del día 1', async () => {
    serverDay = 31;
    const user = userEvent.setup();
    renderApp();
    await click(user, 'Marcar descanso completado');

    expect(await screen.findByRole('heading', { name: '¡Día 31 completado!' })).toBeInTheDocument();
    expect(screen.getByText('¡Felicidades, has completado el ciclo 1!')).toBeInTheDocument();
    expect(screen.getByText(/Día 32 · Ciclo 2 · Día\s+1 del programa/)).toBeInTheDocument();

    await click(user, 'Continuar');
    expect(await screen.findByRole('heading', { name: 'Día 32' })).toBeInTheDocument();
    expect(screen.getByText('Ciclo 2 · Día 1 del programa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fuerza A + Cardio 15 min' })).toBeInTheDocument();
  });
});
