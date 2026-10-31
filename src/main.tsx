import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigError } from './app/ConfigError';
import './index.css';
import { EnvError, parseEnv } from './lib/env';

const configIssues = (): string[] => {
  try {
    parseEnv(import.meta.env);
    return [];
  } catch (error) {
    if (error instanceof EnvError) return error.issues;
    throw error;
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento raíz');
const root = createRoot(rootElement);

const issues = configIssues();

if (issues.length > 0) {
  root.render(<ConfigError issues={issues} />);
} else {
  // Carga diferida: el cliente de Supabase exige una configuración válida al importarse.
  const [{ App }, { startAuthListener }] = await Promise.all([
    import('./app/App'),
    import('./features/auth/authSession'),
  ]);
  startAuthListener();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
