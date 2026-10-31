import { useQuery } from '@tanstack/react-query';
import { cachedRead } from '../../lib/offline/cachedRead';
import { useUserId } from '../auth/authStore';
import { AVATAR_URL_TTL_SECONDS, fetchAvatarUrl, fetchProfile, fetchSettings } from './api';

/** Margen para renovar la URL firmada antes de que caduque. */
const AVATAR_URL_REFRESH_MS = (AVATAR_URL_TTL_SECONDS - 600) * 1000;

export const useProfile = () => {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => cachedRead(userId, 'profile', () => fetchProfile(userId)),
  });
};

export const useSettings = () => {
  const userId = useUserId();
  return useQuery({
    queryKey: ['settings', userId],
    queryFn: () => cachedRead(userId, 'settings', () => fetchSettings(userId)),
  });
};

export const useAvatarUrl = (path: string | null | undefined) => {
  const userId = useUserId();
  return useQuery({
    queryKey: ['avatar-url', userId, path],
    queryFn: () => fetchAvatarUrl(path as string),
    enabled: Boolean(path),
    staleTime: AVATAR_URL_REFRESH_MS,
    refetchInterval: AVATAR_URL_REFRESH_MS,
  });
};
