import { kvGet, kvSet } from '../idb';
import { isNetworkFailure } from './errors';

/** Lee del servidor y guarda una copia local; sin conexión devuelve la última copia conocida. */
export const cachedRead = async <T>(userId: string, key: string, read: () => Promise<T>) => {
  try {
    const value = await read();
    await kvSet(userId, key, value).catch(() => undefined);
    return value;
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const cached = await kvGet<T>(userId, key).catch(() => undefined);
    if (cached === undefined) throw error;
    return cached;
  }
};
