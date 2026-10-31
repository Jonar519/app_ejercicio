import 'fake-indexeddb/auto';
import { RemoteError, isTransientError } from './errors';
import { backoffMs, enqueue, flushQueue, readQueue, type SyncOperation } from './queue';

const operation = (globalDay: number): SyncOperation => ({ type: 'complete_day', globalDay });

let userId: string;

beforeEach(() => {
  userId = crypto.randomUUID();
});

const flush = (execute: (operation: SyncOperation) => Promise<void>, now = 1000, force = false) =>
  flushQueue(userId, { execute, isTransient: isTransientError, now, force });

describe('cola offline', () => {
  it('encola y envía en orden', async () => {
    await enqueue(userId, operation(1));
    await enqueue(userId, operation(2));
    const sent: SyncOperation[] = [];
    const result = await flush(async (item) => void sent.push(item));
    expect(sent).toEqual([operation(1), operation(2)]);
    expect(result).toEqual({ synced: 2, failed: 0, blocked: false });
    expect(await readQueue(userId)).toEqual([]);
  });

  it('detiene el envío ante un error transitorio y conserva el orden', async () => {
    await enqueue(userId, operation(1));
    await enqueue(userId, operation(2));
    const execute = vi.fn().mockRejectedValue(new RemoteError('sin red', 0));
    const result = await flush(execute);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.blocked).toBe(true);
    const items = await readQueue(userId);
    expect(items.map((item) => item.operation)).toEqual([operation(1), operation(2)]);
    expect(items[0]).toMatchObject({ attempts: 1, nextAttemptAt: 1000 + backoffMs(0) });
  });

  it('respeta la espera entre reintentos salvo que se fuerce', async () => {
    await enqueue(userId, operation(1));
    await flush(vi.fn().mockRejectedValue(new RemoteError('sin red', 503)));

    const execute = vi.fn().mockResolvedValue(undefined);
    expect((await flush(execute, 1001)).blocked).toBe(true);
    expect(execute).not.toHaveBeenCalled();

    expect((await flush(execute, 1001, true)).synced).toBe(1);
    expect(await readQueue(userId)).toEqual([]);
  });

  it('reintenta hasta sincronizar y no envía nada dos veces', async () => {
    await enqueue(userId, operation(1));
    await enqueue(userId, operation(2));
    const accepted: SyncOperation[] = [];
    let online = false;
    const execute = async (item: SyncOperation) => {
      if (!online) throw new TypeError('Failed to fetch');
      accepted.push(item);
    };

    await flush(execute);
    online = true;
    await flush(execute, 2000, true);
    await flush(execute, 3000, true);

    expect(accepted).toEqual([operation(1), operation(2)]);
  });

  it('aparta un rechazo definitivo sin bloquear lo siguiente', async () => {
    await enqueue(userId, operation(1));
    await enqueue(userId, operation(2));
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new RemoteError('day_mismatch', 400))
      .mockResolvedValueOnce(undefined);
    const result = await flush(execute);
    expect(result).toEqual({ synced: 1, failed: 1, blocked: false });
    expect(await readQueue(userId)).toMatchObject([{ failed: true, operation: operation(1) }]);

    const later = vi.fn();
    await flush(later);
    expect(later).not.toHaveBeenCalled();
  });

  it('la espera crece hasta un máximo', () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(60_000);
  });
});

describe('clasificación de errores', () => {
  it.each([0, 401, 408, 429, 500, 503])('el estado %i se reintenta', (status) => {
    expect(isTransientError(new RemoteError('x', status))).toBe(true);
  });

  it.each([400, 403, 404, 409])('el estado %i es definitivo', (status) => {
    expect(isTransientError(new RemoteError('x', status))).toBe(false);
  });
});
