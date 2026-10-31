import { MIN_PASSWORD_LENGTH } from './schemas';

export type StrengthLevel = 0 | 1 | 2 | 3;

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: 'Demasiado corta',
  1: 'Débil',
  2: 'Aceptable',
  3: 'Fuerte',
};

const VERY_LONG_PASSWORD = 16;

const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];

const COMMON_FRAGMENTS = /(123456|password|contrase|qwerty|abcdef|(.)\2{3,})/i;

export const passwordStrength = (password: string): StrengthLevel => {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  if (COMMON_FRAGMENTS.test(password)) return 1;
  const classes = CHARACTER_CLASSES.filter((characterClass) =>
    characterClass.test(password),
  ).length;
  if (classes >= 3 && password.length >= VERY_LONG_PASSWORD) return 3;
  if (classes >= 4) return 3;
  return classes >= 2 ? 2 : 1;
};
