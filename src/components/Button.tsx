import type { ButtonHTMLAttributes } from 'react';

const VARIANTS = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
  secondary:
    'border border-neutral-400 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = 'primary', className = '', type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`min-h-11 rounded-lg px-4 py-2 font-semibold disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
