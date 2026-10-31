import { supabase } from '../../lib/supabase';
import { avatarPath } from './avatar';
import { exportSchema, profileSchema, settingsSchema, type Settings } from './schemas';

const AVATARS_BUCKET = 'avatars';
export const AVATAR_URL_TTL_SECONDS = 3600;

const PROFILE_COLUMNS = 'id, display_name, avatar_url';
const SETTINGS_COLUMNS =
  'weight_unit, daily_calorie_goal, rest_between_sets_seconds, rest_between_exercises_seconds, sound_enabled, vibration_enabled';

export const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
};

export const updateDisplayName = async (userId: string, displayName: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
};

export const fetchSettings = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return settingsSchema.parse(data);
};

export const updateSettings = async (userId: string, settings: Settings) => {
  const { data, error } = await supabase
    .from('user_settings')
    .update(settings)
    .eq('user_id', userId)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) throw error;
  return settingsSchema.parse(data);
};

export const fetchAvatarUrl = async (path: string) => {
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, AVATAR_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
};

/** Sube el archivo nuevo y, solo cuando el perfil ya lo referencia, retira el anterior. */
export const replaceAvatar = async (userId: string, image: Blob, previousPath: string | null) => {
  const path = avatarPath(userId, image.type);
  const storage = supabase.storage.from(AVATARS_BUCKET);
  const { error: uploadError } = await storage.upload(path, image, {
    contentType: image.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    await storage.remove([path]);
    throw error;
  }
  if (previousPath) await storage.remove([previousPath]);
  return profileSchema.parse(data);
};

export const exportMyData = async () => {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return exportSchema.parse(data);
};

/** Storage no permite borrar archivos por SQL: se eliminan antes de borrar la cuenta. */
export const deleteMyAccount = async (userId: string, confirmation: string) => {
  const storage = supabase.storage.from(AVATARS_BUCKET);
  const { data: files, error: listError } = await storage.list(userId);
  if (listError) throw listError;
  if (files.length > 0) {
    const { error } = await storage.remove(files.map((file) => `${userId}/${file.name}`));
    if (error) throw error;
  }
  const { error } = await supabase.rpc('delete_my_account', { p_confirmation: confirmation });
  if (error) throw error;
};
