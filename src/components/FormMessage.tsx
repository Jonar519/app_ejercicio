import type { ReactNode } from 'react';

const STYLES = {
  error: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

interface FormMessageProps {
  kind: keyof typeof STYLES;
  children?: ReactNode;
}

export function FormMessage({ kind, children }: FormMessageProps) {
  if (!children) return null;
  return (
    <p className={`rounded-lg p-3 ${STYLES[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
