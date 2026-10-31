import 'fake-indexeddb/auto';
import { waitFor } from '@testing-library/react';
import { RemoteError } from './errors';
import { executeOperation } from './executeOperation';
import { readQueue, type SyncOperation } from './queue';
import { enqueueOperation, flushNow, startSync, useSyncStore } from './sync';

vi.mock('./executeOperation', () => ({ executeOperation: vi.fn() }));

const execute = vi.mocked(executeOperation);
const COMPLETE: SyncOperation = { type: 'complete_day', globalDay: 1 };

const goOnline = () => window.dispatchEvent(new Event('online'));
const goOffline = () => window.dispatchEvent(new Event('offline'));

let stop: () => void;
let userId: string;
let onSynced: ReturnType<typeof vi.fn<() => void>>;

beforeEach(async () => {
  execute.mockReset().mockResolvedValue(undefined);
  userId = crypto.randomUUID();
  onSynced = vi.fn<() => void>();
  useSyncStore.setState({ online: true, syncing: false, pending: 0, failed: 0 });
  stop = startSync(userId, onSynced);
  await flushNow(userId);
});

afterEach(() => stop());

describe('sincronización', () => {
  it('sin conexión guarda en la cola y no envía', async () => {
    goOffline();
    await enqueueOperation(userId, COMPLETE);
    expect(execute).not.toHaveBeenCalled();
    expect(useSyncStore.getState()).toMatchObject({ online: false, pending: 1 });
  });

  it('al recuperar la conexión envía lo pendiente una sola vez', async () => {
    goOffline();
    await enqueueOperation(userId, { type: 'food_delete', id: 'a' });
    await enqueueOperation(userId, COMPLETE);

    goOnline();
    await waitFor(() => expect(useSyncStore.getState().pending).toBe(0));
    await waitFor(() => expect(useSyncStore.getState().syncing).toBe(false));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(await readQueue(userId)).toEqual([]);
    expect(onSynced).toHaveBeenCalled();

    goOnline();
    await flushNow(userId, true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('conserva la operación si el servidor falla y la reenvía al reconectar', async () => {
    execute.mockRejectedValueOnce(new RemoteError('caído', 503));
    await enqueueOperation(userId, COMPLETE);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSyncStore.getState().syncing).toBe(false));
    expect(useSyncStore.getState().pending).toBe(1);

    goOnline();
    await waitFor(() => expect(useSyncStore.getState().pending).toBe(0));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('cuenta aparte lo que el servidor rechaza', async () => {
    execute.mockRejectedValueOnce(new RemoteError('day_mismatch', 400));
    await enqueueOperation(userId, COMPLETE);
    await waitFor(() => expect(useSyncStore.getState().failed).toBe(1));
    expect(useSyncStore.getState().pending).toBe(0);
  });
});
