import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div>
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">App Ejercicio</p>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      {children}
    </main>
  );
}
