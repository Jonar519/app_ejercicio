import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LOGIN_FAILED_MESSAGE, logIn, register } from '../features/auth/authApi';
import { avatarPath } from '../features/profile/avatar';
import {
  deleteMyAccount,
  exportMyData,
  fetchProfile,
  fetchSettings,
} from '../features/profile/api';
import { parseEnv } from '../lib/env';
import { supabase as appClient } from '../lib/supabase';

const env = parseEnv(import.meta.env);
const PASSWORD = 'Fr4se-de-prueba-local';
const BUCKET = 'avatars';

// PNG transparente de 1×1.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);
const pngBlob = () => new Blob([PNG], { type: 'image/png' });

const newClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const uniqueEmail = (label: string) => `${label}-${crypto.randomUUID()}@ejemplo.test`;

const createUser = async (label: string) => {
  const client = newClient();
  const email = uniqueEmail(label);
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario: ${error?.message}`);
  return { client, email, id: data.user.id };
};

const uploadAvatar = async (client: SupabaseClient, userId: string) => {
  const path = avatarPath(userId, 'image/webp');
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, pngBlob(), { contentType: 'image/png' });
  if (error) throw new Error(`No se pudo subir: ${error.message}`);
  return path;
};

describe('autenticación real', () => {
  it('el registro crea perfil, preferencias y progreso en el día 1', async () => {
    const email = uniqueEmail('registro');
    expect(await register(email, PASSWORD)).toMatchObject({ ok: true });
    const { data } = await appClient.auth.getUser();
    const userId = data.user?.id as string;
    expect(await fetchProfile(userId)).toMatchObject({ id: userId, avatar_url: null });
    expect(await fetchSettings(userId)).toMatchObject({ weight_unit: 'kg' });
    const { data: progress } = await appClient.from('user_progress').select('global_day').single();
    expect(progress).toEqual({ global_day: 1 });
    await appClient.auth.signOut();
  });

  it('el servidor rechaza contraseñas de menos de 10 caracteres', async () => {
    const { error } = await newClient().auth.signUp({
      email: uniqueEmail('corta'),
      password: 'Corta-123',
    });
    expect(error?.code).toBe('weak_password');
  });

  it('el login funciona y sus errores no revelan si el email existe', async () => {
    const { email } = await createUser('login');
    expect(await logIn(email, PASSWORD)).toEqual({ ok: true });
    await appClient.auth.signOut();

    const failed = { ok: false, message: LOGIN_FAILED_MESSAGE };
    expect(await logIn(email, 'Clave-incorrecta-1')).toEqual(failed);
    expect(await logIn(uniqueEmail('nadie'), 'Clave-incorrecta-1')).toEqual(failed);
  });

  it('registrar un email existente responde como uno nuevo', async () => {
    const { email } = await createUser('duplicado');
    await appClient.auth.signOut();
    expect(await register(email, PASSWORD)).toEqual({ ok: true, awaitingConfirmation: true });
  });
});

describe('avatares en Storage real', () => {
  it('el dueño sube, lee con URL firmada y renueva una URL caducada', async () => {
    const { client, id } = await createUser('dueno');
    const path = await uploadAvatar(client, id);
    const storage = client.storage.from(BUCKET);

    const { data: fresh } = await storage.createSignedUrl(path, 60);
    expect((await fetch(fresh?.signedUrl as string)).status).toBe(200);

    const { data: expiring } = await storage.createSignedUrl(path, 1);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect((await fetch(expiring?.signedUrl as string)).ok).toBe(false);

    const { data: renewed } = await storage.createSignedUrl(path, 60);
    expect((await fetch(renewed?.signedUrl as string)).status).toBe(200);
  });

  it('el bucket es privado', async () => {
    const { client, id } = await createUser('privado');
    const path = await uploadAvatar(client, id);
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });

  it('un usuario no puede leer ni escribir el avatar de otro', async () => {
    const owner = await createUser('victima');
    const other = await createUser('otro');
    const path = await uploadAvatar(owner.client, owner.id);
    const theirs = other.client.storage.from(BUCKET);

    expect((await theirs.download(path)).error).not.toBeNull();
    expect((await theirs.createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await theirs.list(owner.id)).data).toEqual([]);
    expect((await theirs.upload(path, pngBlob(), { upsert: true })).error).not.toBeNull();
    expect(
      (await theirs.upload(`${owner.id}/${crypto.randomUUID()}.webp`, pngBlob())).error,
    ).not.toBeNull();
    await theirs.remove([path]);

    const { data } = await owner.client.storage.from(BUCKET).download(path);
    expect(data?.size).toBe(PNG.length);
  });

  it('anon no accede a los avatares', async () => {
    const owner = await createUser('anon');
    const path = await uploadAvatar(owner.client, owner.id);
    const anon = newClient().storage.from(BUCKET);
    expect((await anon.download(path)).error).not.toBeNull();
    expect((await anon.upload(`${owner.id}/x.webp`, pngBlob())).error).not.toBeNull();
  });

  it('el bucket impone tamaño y tipo aunque el cliente no los valide', async () => {
    const { client, id } = await createUser('limites');
    const storage = client.storage.from(BUCKET);
    const tooBig = new Blob([new Uint8Array(524289)], { type: 'image/png' });
    const html = new Blob(['<script>'], { type: 'text/html' });
    expect((await storage.upload(`${id}/grande.png`, tooBig)).error).not.toBeNull();
    expect((await storage.upload(`${id}/pagina.html`, html)).error).not.toBeNull();
  });
});

describe('datos del usuario reales', () => {
  it('exporta los datos propios y elimina la cuenta con su avatar', async () => {
    const email = uniqueEmail('borrado');
    expect(await register(email, PASSWORD)).toMatchObject({ ok: true });
    const { data } = await appClient.auth.getUser();
    const userId = data.user?.id as string;
    await uploadAvatar(appClient, userId);

    expect((await exportMyData()).profile.id).toBe(userId);

    await deleteMyAccount(userId, 'ELIMINAR');
    await appClient.auth.signOut({ scope: 'local' });

    const client = newClient();
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(error).not.toBeNull();
  });

  it('el borrado exige la confirmación en el servidor', async () => {
    const { client } = await createUser('confirmacion');
    const { error } = await client.rpc('delete_my_account', { p_confirmation: 'no' });
    expect(error?.message).toBe('confirmation_required');
  });
});
