import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LOGIN_FAILED_MESSAGE, REQUEST_SENT_MESSAGE } from './authApi';
import { useAuthStore } from './authStore';
import { LoginPage } from './LoginPage';
import { RecoverPage } from './RecoverPage';
import { RegisterPage } from './RegisterPage';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const auth = vi.mocked(supabase.auth);
const authError = (status: number, code?: string) => ({ error: { status, code }, data: {} });
const VALID_PASSWORD = 'Fr4se-larga-segura';

const renderPage = (page: ReactNode) => {
  render(<MemoryRouter>{page}</MemoryRouter>);
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ status: 'ready', session: null, recovery: false });
});

describe('inicio de sesión', () => {
  const submit = async (email: string, password: string) => {
    const user = renderPage(<LoginPage />);
    if (email) await user.type(screen.getByLabelText('Email'), email);
    if (password) await user.type(screen.getByLabelText('Contraseña'), password);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
  };

  it('valida los campos antes de llamar al servidor', async () => {
    await submit('no-es-email', '');
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    expect(screen.getByText('Introduce tu contraseña')).toBeInTheDocument();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['credenciales inválidas', 400, 'invalid_credentials'],
    ['email sin confirmar', 400, 'email_not_confirmed'],
    ['usuario inexistente', 400, 'user_not_found'],
  ])('muestra el mismo mensaje genérico con %s', async (_case, status, code) => {
    auth.signInWithPassword.mockResolvedValue(authError(status, code) as never);
    await submit('ana@ejemplo.com', 'una-clave');
    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_FAILED_MESSAGE);
  });

  it('informa del límite de intentos', async () => {
    auth.signInWithPassword.mockResolvedValue(authError(429) as never);
    await submit('ana@ejemplo.com', 'una-clave');
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });
});

describe('registro', () => {
  const fill = async (email: string, password: string, confirmation: string) => {
    const user = renderPage(<RegisterPage />);
    await user.type(screen.getByLabelText('Email'), email);
    await user.type(screen.getByLabelText('Contraseña'), password);
    await user.type(screen.getByLabelText('Repite la contraseña'), confirmation);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  };

  it('exige 10 caracteres y muestra la fortaleza', async () => {
    await fill('ana@ejemplo.com', 'corta', 'corta');
    expect(screen.getByText('Usa al menos 10 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Seguridad: Demasiado corta')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('exige que las contraseñas coincidan', async () => {
    await fill('ana@ejemplo.com', VALID_PASSWORD, `${VALID_PASSWORD}x`);
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('responde igual si el email ya existe que si es nuevo', async () => {
    auth.signUp.mockResolvedValue({ ...authError(422, 'user_already_exists') } as never);
    await fill('ana@ejemplo.com', VALID_PASSWORD, VALID_PASSWORD);
    expect(await screen.findByRole('status')).toHaveTextContent(REQUEST_SENT_MESSAGE);
  });

  it('pide revisar el correo cuando hay que confirmarlo', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null } as never);
    await fill('nueva@ejemplo.com', VALID_PASSWORD, VALID_PASSWORD);
    expect(await screen.findByRole('status')).toHaveTextContent(REQUEST_SENT_MESSAGE);
  });
});

describe('recuperación', () => {
  const request = async (email: string) => {
    const user = renderPage(<RecoverPage />);
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
  };

  it('valida el email', async () => {
    await request('mal');
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('confirma de forma genérica y redirige a /restablecer', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(authError(400, 'user_not_found') as never);
    await request('nadie@ejemplo.com');
    expect(await screen.findByRole('status')).toHaveTextContent(REQUEST_SENT_MESSAGE);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('nadie@ejemplo.com', {
      redirectTo: `${window.location.origin}/restablecer`,
    });
  });
});

describe('restablecimiento', () => {
  it('rechaza el acceso sin evento PASSWORD_RECOVERY', () => {
    renderPage(<ResetPasswordPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('caducado');
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
  });

  it('cambia la contraseña, cierra otras sesiones y sale del modo recuperación', async () => {
    useAuthStore.setState({ recovery: true });
    auth.updateUser.mockResolvedValue({ data: {}, error: null } as never);
    auth.signOut.mockResolvedValue({ error: null });
    const user = renderPage(<ResetPasswordPage />);
    await user.type(screen.getByLabelText('Nueva contraseña'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Repite la contraseña'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(useAuthStore.getState().recovery).toBe(false));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });
});
