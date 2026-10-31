import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'app-ejercicio-install-dismissed';

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

interface InstallState {
  promptEvent: BeforeInstallPromptEvent | null;
  dismissed: boolean;
}

export const useInstallStore = create<InstallState>(() => ({
  promptEvent: null,
  dismissed: wasDismissed(),
}));

/** Debe ejecutarse al arrancar: el navegador lanza el evento una sola vez y muy pronto. */
export const listenForInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstallStore.setState({ promptEvent: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallStore.setState({ promptEvent: null }));
};

export const dismissInstall = () => {
  useInstallStore.setState({ dismissed: true });
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Sin almacenamiento el aviso volverá a aparecer en la próxima visita.
  }
};

export const promptInstall = async () => {
  const { promptEvent } = useInstallStore.getState();
  if (!promptEvent) return;
  await promptEvent.prompt();
  await promptEvent.userChoice;
  useInstallStore.setState({ promptEvent: null });
};

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPadOS se identifica como Mac, pero con pantalla táctil. */
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
