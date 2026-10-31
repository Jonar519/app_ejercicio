import { PROGRAM } from '../data/program';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-3xl font-bold">App Ejercicio</h1>
      <p className="text-neutral-600 dark:text-neutral-300">
        Programa de {PROGRAM.length} días con registro de entrenamiento y nutrición.
      </p>
    </main>
  );
}
