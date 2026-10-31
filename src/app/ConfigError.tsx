interface ConfigErrorProps {
  issues: string[];
}

export function ConfigError({ issues }: ConfigErrorProps) {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6"
      role="alert"
    >
      <h1 className="text-2xl font-bold">La aplicación no está configurada</h1>
      <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-300">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </main>
  );
}
