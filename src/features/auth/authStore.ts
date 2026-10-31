import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  status: 'loading' | 'ready';
  session: Session | null;
  /** La sesión viene de un enlace de recuperación: hasta cambiar la contraseña no da acceso. */
  recovery: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  status: 'loading',
  session: null,
  recovery: false,
}));

export const useUserId = () => {
  const userId = useAuthStore((state) => state.session?.user.id);
  if (!userId) throw new Error('Se requiere una sesión');
  return userId;
};
