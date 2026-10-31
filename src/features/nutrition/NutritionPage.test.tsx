import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { readQueue } from '../../lib/offline/queue';
import { toLocalDate } from '../../lib/format';
import { useAuthStore } from '../auth/authStore';
import { mergePendingFood, type FoodLog } from './food';
import { NutritionPage } from './NutritionPage';

vi.mock('../../lib/offline/sync', async () => {
  const { enqueue } = await import('../../lib/offline/queue');
  return { enqueueOperation: enqueue };
});

const SERVER_FOOD: FoodLog = {
  id: '22222222-2222-4222-8222-222222222222',
  log_date: toLocalDate(new Date()),
  name: 'Avena',
  calories: 1800,
};

const requestedDates: string[] = [];

vi.mock('../../lib/supabase', () => {
  const from = (table: string) => {
    let date: string | undefined;
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        if (column === 'log_date') date = value;
        return query;
      },
      order: async () => {
        if (date) requestedDates.push(date);
        return { data: date === SERVER_FOOD.log_date ? [SERVER_FOOD] : [], error: null };
      },
      single: async () => ({
        data:
          table === 'user_settings'
            ? {
                weight_unit: 'kg',
                daily_calorie_goal: 2000,
                rest_between_sets_seconds: 45,
                rest_between_exercises_seconds: 60,
                sound_enabled: true,
                vibration_enabled: true,
              }
            : null,
        error: null,
      }),
    };
    return query;
  };
  return { supabase: { from } };
});

let userId: string;

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NutritionPage />
    </QueryClientProvider>,
  );

beforeEach(() => {
  userId = crypto.randomUUID();
  requestedDates.length = 0;
  useAuthStore.setState({
    status: 'ready',
    session: { user: { id: userId } } as Session,
    recovery: false,
  });
});

describe('nutrición', () => {
  it('muestra el total frente a la meta y las calorías restantes', async () => {
    renderPage();
    expect(await screen.findByText('Avena')).toBeInTheDocument();
    expect(await screen.findByText('200 kcal restantes')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
  });

  it('añade un alimento, encola la escritura y avisa del exceso', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Avena');
    await user.type(screen.getByLabelText('Alimento'), 'Pizza');
    await user.type(screen.getByLabelText('Calorías estimadas'), '500');
    await user.click(screen.getByRole('button', { name: 'Añadir alimento' }));

    expect(await screen.findByText('Pizza')).toBeInTheDocument();
    expect(await screen.findByText('300 kcal excedidas')).toBeInTheDocument();
    expect(screen.getByLabelText('Alimento')).toHaveValue('');
    const [item] = await readQueue(userId);
    expect(item?.operation).toMatchObject({ type: 'food_upsert', name: 'Pizza', calories: 500 });
  });

  it('valida el formulario', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Avena');
    await user.click(screen.getByRole('button', { name: 'Añadir alimento' }));
    expect(screen.getByText('Escribe el nombre del alimento')).toBeInTheDocument();
    expect(screen.getByText('Introduce las calorías')).toBeInTheDocument();
    expect(await readQueue(userId)).toEqual([]);
  });

  it('edita y elimina una entrada conservando su id', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar Avena' }));
    const form = screen.getByRole('button', { name: 'Guardar cambios' }).closest('form');
    const calories = within(form as HTMLElement).getByLabelText('Calorías estimadas');
    await user.clear(calories);
    await user.type(calories, '400');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('400 kcal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar Avena' }));
    await waitFor(() => expect(screen.queryByText('Avena')).not.toBeInTheDocument());

    const operations = (await readQueue(userId)).map((item) => item.operation);
    expect(operations).toMatchObject([
      { type: 'food_upsert', id: SERVER_FOOD.id, calories: 400 },
      { type: 'food_delete', id: SERVER_FOOD.id },
    ]);
  });

  it('navega a días anteriores, pero no al futuro', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Avena');
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Día anterior' }));
    expect(await screen.findByText('No hay alimentos registrados este día.')).toBeInTheDocument();
    expect(requestedDates.at(-1)).not.toBe(SERVER_FOOD.log_date);
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeEnabled();
  });
});

describe('alimentos pendientes', () => {
  const item = (operation: Parameters<typeof mergePendingFood>[1][number]['operation']) => ({
    seq: 1,
    id: crypto.randomUUID(),
    operation,
    attempts: 0,
    nextAttemptAt: 0,
    failed: false,
  });

  it('no muestra un alimento pendiente de otra fecha', () => {
    const operation = {
      type: 'food_upsert',
      id: crypto.randomUUID(),
      logDate: '2026-01-01',
      name: 'Otro',
      calories: 1,
    } as const;
    expect(mergePendingFood([], [item(operation)], '2026-01-02')).toEqual([]);
  });
});
