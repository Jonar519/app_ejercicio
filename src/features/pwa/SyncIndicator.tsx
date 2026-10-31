import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useSyncStore } from '../../lib/offline/sync';

const describe = ({
  online,
  syncing,
  pending,
  failed,
}: ReturnType<typeof useSyncStore.getState>) => {
  if (!online) return { label: 'Sin conexión', icon: CloudOff };
  if (syncing || pending > 0) return { label: 'Sincronizando', icon: RefreshCw };
  if (failed > 0) return { label: `${failed} sin sincronizar`, icon: TriangleAlert };
  return { label: 'Sincronizado', icon: CloudCheck };
};

export function SyncIndicator() {
  const { label, icon: Icon } = describe(useSyncStore());

  return (
    <p
      role="status"
      className="flex items-center gap-1 text-sm text-neutral-700 dark:text-neutral-300"
    >
      <Icon aria-hidden="true" size={16} />
      {label}
    </p>
  );
}
