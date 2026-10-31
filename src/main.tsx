import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
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

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento raíz');

const issues = configIssues();

createRoot(root).render(
  <StrictMode>{issues.length > 0 ? <ConfigError issues={issues} /> : <App />}</StrictMode>,
);
