import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import 'fake-indexeddb/auto';
import { queryClient } from '../../app/queryClient';
import { userDatabaseName } from '../../lib/localData';
import { supabase } from '../../lib/supabase';
import { clearMemory, signOut, startAuthListener } from './authSession';
import { useAuthStore } from './authStore';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(), onAuthStateChange: vi.fn() } },
}));

const auth = vi.mocked(supabase.auth);
const USER_A = '11111111-1111-4111-8111-111111111111';
const session = (id: string) => ({ user: { id } }) as Session;

const openDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(new Error('fallo al abrir'));
  });

const databaseNames = async () =>
  (await indexedDB.databases()).map((database) => database.name).sort();

const fakeCaches = () => {
  const names = new Set(['workbox-precache-v2', 'workbox-runtime', 'datos']);
  vi.stubGlobal('caches', {
    keys: async () => [...names],
    delete: async (name: string) => names.delete(name),
  });
  return names;
};

const seedUserData = async () => {
  useAuthStore.setState({ status: 'ready', session: session(USER_A), recovery: false });
  queryClient.setQueryData(['profile', USER_A], { display_name: 'Ana' });
  localStorage.setItem('sb-ejemplo-auth-token', 'token');
  localStorage.setItem('sb-ejemplo-auth-token-code-verifier', 'verifier');
  localStorage.setItem('app-ejercicio:borrador', 'dato');
  sessionStorage.setItem('app-ejercicio:paso', 'dato');
  await openDatabase(userDatabaseName(USER_A));
};

const expectNothingLeft = async () => {
  expect(useAuthStore.getState()).toMatchObject({ session: null, recovery: false });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(await databaseNames()).not.toContain(userDatabaseName(USER_A));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('cierre de sesión', () => {
  it('no deja datos en memoria, IndexedDB, almacenamiento ni cachés privadas', async () => {
    const caches = fakeCaches();
    auth.signOut.mockResolvedValue({ error: null });
    await seedUserData();
    await signOut();
    await expectNothingLeft();
    expect([...caches]).toEqual(['workbox-precache-v2']);
  });

  it('limpia todo aunque el servidor no responda', async () => {
    fakeCaches();
    auth.signOut.mockResolvedValueOnce({ error: { message: 'red' } } as never);
    auth.signOut.mockResolvedValueOnce({ error: null });
    await seedUserData();
    await signOut();
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    await expectNothingLeft();
  });

  it('solo borra lo que pertenece a la app', async () => {
    fakeCaches();
    auth.signOut.mockResolvedValue({ error: null });
    localStorage.setItem('otra-app', 'dato');
    await openDatabase('otra-base');
    await signOut();
    expect(localStorage.getItem('otra-app')).toBe('dato');
    expect(await databaseNames()).toContain('otra-base');
  });

  it('segmenta las bases locales por usuario', () => {
    expect(userDatabaseName('a')).not.toBe(userDatabaseName('b'));
  });
});

describe('eventos de autenticación', () => {
  let emit: (event: AuthChangeEvent, session: Session | null) => void;

  beforeEach(() => {
    auth.onAuthStateChange.mockImplementation((callback) => {
      emit = callback as typeof emit;
      return {} as never;
    });
    clearMemory();
    useAuthStore.setState({ status: 'loading' });
    startAuthListener();
  });

  it('la sesión inicial marca la app como lista', () => {
    emit('INITIAL_SESSION', session(USER_A));
    expect(useAuthStore.getState()).toMatchObject({ status: 'ready', recovery: false });
  });

  it('PASSWORD_RECOVERY activa el modo recuperación', () => {
    emit('PASSWORD_RECOVERY', session(USER_A));
    expect(useAuthStore.getState().recovery).toBe(true);
    emit('TOKEN_REFRESHED', session(USER_A));
    expect(useAuthStore.getState().recovery).toBe(true);
  });

  it('SIGNED_OUT vacía la memoria', () => {
    emit('SIGNED_IN', session(USER_A));
    queryClient.setQueryData(['profile', USER_A], {});
    emit('SIGNED_OUT', null);
    expect(useAuthStore.getState().session).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('un cambio de usuario no conserva los datos del anterior', () => {
    emit('SIGNED_IN', session(USER_A));
    queryClient.setQueryData(['profile', USER_A], {});
    emit('SIGNED_IN', session('22222222-2222-4222-8222-222222222222'));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
