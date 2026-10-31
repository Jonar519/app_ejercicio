import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="min-h-11 rounded-lg border border-neutral-400 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-sm text-neutral-700 dark:text-neutral-300">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
