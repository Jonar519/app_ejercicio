import { STRENGTH_LABELS, passwordStrength, type StrengthLevel } from './passwordStrength';

const BAR_COLORS: Record<StrengthLevel, string> = {
  0: 'bg-red-600',
  1: 'bg-red-600',
  2: 'bg-amber-500',
  3: 'bg-emerald-600',
};

const BARS = [1, 2, 3] as const;

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  const level = passwordStrength(password);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" aria-hidden="true">
        {BARS.map((bar) => (
          <span
            key={bar}
            className={`h-1.5 flex-1 rounded ${
              bar <= level ? BAR_COLORS[level] : 'bg-neutral-200 dark:bg-neutral-700'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Seguridad: {STRENGTH_LABELS[level]}
      </p>
    </div>
  );
}
