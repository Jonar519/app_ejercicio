import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from './authStore';

export type AuthResult =
  { ok: true; awaitingConfirmation?: boolean } | { ok: false; message: string };

const NETWORK_MESSAGE = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
const RATE_LIMIT_MESSAGE = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
export const LOGIN_FAILED_MESSAGE = 'Email o contraseña incorrectos, o cuenta sin confirmar.';
export const REQUEST_SENT_MESSAGE =
  'Si los datos son correctos, recibirás un correo con las instrucciones.';

const operationalMessage = (error: { status?: number } | null) => {
  if (!error) return null;
  if (isAuthRetryableFetchError(error)) return NETWORK_MESSAGE;
  return error.status === 429 ? RATE_LIMIT_MESSAGE : null;
};

const resetRedirectUrl = () => `${window.location.origin}/restablecer`;

export const logIn = async (email: string, password: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return { ok: false, message: operationalMessage(error) ?? LOGIN_FAILED_MESSAGE };
};

/** Un email ya registrado se responde igual que uno nuevo para no revelar que existe. */
export const register = async (email: string, password: string): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  const message = operationalMessage(error);
  if (message) return { ok: false, message };
  if (error?.code === 'weak_password') {
    return { ok: false, message: 'Esa contraseña no es segura. Elige otra.' };
  }
  return { ok: true, awaitingConfirmation: !data.session };
};

export const requestPasswordReset = async (email: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirectUrl(),
  });
  const message = operationalMessage(error);
  return message ? { ok: false, message } : { ok: true };
};

/** Cambia la contraseña y expulsa las demás sesiones, que pudo abrir quien la conocía. */
export const updatePassword = async (password: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message:
        operationalMessage(error) ?? 'No se pudo cambiar la contraseña. Solicita otro enlace.',
    };
  }
  await supabase.auth.signOut({ scope: 'others' });
  useAuthStore.setState({ recovery: false });
  return { ok: true };
};
