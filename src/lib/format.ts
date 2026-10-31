const LOCALE = 'es';

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const longDateFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export const formatNumber = (value: number) => numberFormat.format(value);

export const formatDate = (date: Date) => dateFormat.format(date);

export const formatLongDate = (date: Date) => longDateFormat.format(date);

/** 75 → `01:15`; 3725 → `1:02:05`. */
export const formatClock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = pad(seconds % 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${rest}` : `${pad(minutes)}:${rest}`;
};

/** Fecha calendario local en formato `YYYY-MM-DD`, sin pasar por UTC. */
export const toLocalDate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Interpreta `YYYY-MM-DD` como fecha local. */
export const parseLocalDate = (value: string) => {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
