import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supabase } from '../../lib/supabase';
import { signOut } from '../auth/authSession';
import { useAuthStore } from '../auth/authStore';
import { DataSection } from './DataSection';

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock('../auth/authSession', () => ({ signOut: vi.fn() }));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const rpc = vi.mocked(supabase.rpc);
const storage = { list: vi.fn(), remove: vi.fn() };

const exportPayload = {
  profile: { id: USER_ID },
  settings: {},
  progress: { global_day: 1 },
  workout_sessions: [],
  exercise_logs: [],
  cardio_logs: [],
  weight_logs: [],
  food_logs: [],
};

const renderSection = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DataSection />
    </QueryClientProvider>,
  );
  return userEvent.setup();
};

const openConfirmation = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
  return screen.getByRole('button', { name: 'Eliminar definitivamente' });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.storage.from).mockReturnValue(storage as never);
  storage.list.mockResolvedValue({ data: [{ name: 'a.webp' }], error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  useAuthStore.setState({
    status: 'ready',
    session: { user: { id: USER_ID } } as Session,
    recovery: false,
  });
  URL.createObjectURL = vi.fn(() => 'blob:prueba');
  URL.revokeObjectURL = vi.fn();
});

describe('exportar mis datos', () => {
  it('descarga un JSON validado con los datos del usuario', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: exportPayload, error: null } as never);
    const user = renderSection();
    await user.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('export_my_data');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual(exportPayload);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba');
  });

  it('no descarga una respuesta inválida', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockClear();
    rpc.mockResolvedValue({ data: { profile: {} }, error: null } as never);
    const user = renderSection();
    await user.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron exportar');
    expect(click).not.toHaveBeenCalled();
  });
});

describe('eliminar mi cuenta', () => {
  it('no se puede confirmar sin escribir la palabra exacta', async () => {
    const user = renderSection();
    const confirm = await openConfirmation(user);
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'eliminar');
    expect(confirm).toBeDisabled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('borra el avatar, después la cuenta y cierra la sesión', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const user = renderSection();
    const confirm = await openConfirmation(user);
    await user.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR');
    await user.click(confirm);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(storage.remove).toHaveBeenCalledWith([`${USER_ID}/a.webp`]);
    expect(rpc).toHaveBeenCalledWith('delete_my_account', { p_confirmation: 'ELIMINAR' });
    expect(storage.remove.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0] as number,
    );
  });

  it('si falla, informa y no cierra la sesión', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } } as never);
    const user = renderSection();
    const confirm = await openConfirmation(user);
    await user.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR');
    await user.click(confirm);
    await waitFor(() =>
      expect(screen.getByText(/No se pudo eliminar la cuenta/)).toBeInTheDocument(),
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
