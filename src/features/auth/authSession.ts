import { queryClient } from '../../app/queryClient';
import { clearLocalData } from '../../lib/localData';
import { supabase } from '../../lib/supabase';
import { resetRunner } from '../workout/runnerStore';
import { useAuthStore } from './authStore';

/** Vacía el estado en memoria sin tocar el dispositivo. */
export const clearMemory = () => {
  queryClient.clear();
  resetRunner();
  useAuthStore.setState({ status: 'ready', session: null, recovery: false });
};

/**
 * Debe llamarse antes de renderizar para no perder PASSWORD_RECOVERY. El callback es síncrono: el
 * SDK mantiene un bloqueo mientras se ejecuta y llamarlo desde aquí provocaría un interbloqueo.
 *
 * SIGNED_OUT también llega al caducar la sesión o desde otra pestaña: solo limpia la memoria, porque
 * los datos del dispositivo se conservan hasta un cierre de sesión explícito.
 */
export const startAuthListener = () =>
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearMemory();
      return;
    }
    const previous = useAuthStore.getState();
    if (previous.session && previous.session.user.id !== session?.user.id) queryClient.clear();
    useAuthStore.setState({
      status: 'ready',
      session,
      recovery: event === 'PASSWORD_RECOVERY' || previous.recovery,
    });
  });

/** Cierra la sesión y limpia todo aunque el servidor no responda. */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: 'local' });
  await clearLocalData();
  clearMemory();
};
