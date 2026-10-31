import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../../components/Button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <aside
      role="status"
      className="fixed inset-x-4 top-4 z-10 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-neutral-900 p-3 text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      <p>Hay una nueva versión disponible.</p>
      <Button onClick={() => void updateServiceWorker(true)}>Actualizar</Button>
    </aside>
  );
}
