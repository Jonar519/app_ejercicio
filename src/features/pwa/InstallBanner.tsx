import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import {
  dismissInstall,
  isIos,
  isStandalone,
  promptInstall,
  useInstallStore,
} from './installPrompt';

function Banner({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="Instalar la aplicación"
      className="flex items-start gap-2 rounded-lg bg-emerald-100 p-3 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"
    >
      <div className="flex flex-1 flex-col gap-2">{children}</div>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
        aria-label="Cerrar aviso de instalación"
        onClick={dismissInstall}
      >
        <X aria-hidden="true" size={20} />
      </button>
    </aside>
  );
}

export function InstallBanner() {
  const promptEvent = useInstallStore((state) => state.promptEvent);
  const dismissed = useInstallStore((state) => state.dismissed);

  if (dismissed || isStandalone()) return null;

  if (promptEvent) {
    return (
      <Banner>
        <p>Instala la app para abrirla desde tu pantalla de inicio, incluso sin conexión.</p>
        <Button className="self-start" onClick={() => void promptInstall()}>
          Instalar
        </Button>
      </Banner>
    );
  }

  if (isIos()) {
    return (
      <Banner>
        <p>Para instalarla en iPhone o iPad: Compartir → Añadir a pantalla de inicio.</p>
      </Banner>
    );
  }

  return null;
}
