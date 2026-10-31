export type WeightUnit = 'kg' | 'lb';

export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;

const LB_PER_KG = 2.2046226218;

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Convierte una entrada del usuario a los kg que se almacenan (`numeric(5,2)`). */
export const toKg = (value: number, unit: WeightUnit) =>
  round(unit === 'kg' ? value : value / LB_PER_KG, 2);

/** Convierte kg almacenados a la unidad de visualización, con un decimal. */
export const fromKg = (weightKg: number, unit: WeightUnit) =>
  round(unit === 'kg' ? weightKg : weightKg * LB_PER_KG, 1);

export const isValidWeightKg = (weightKg: number) =>
  Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG;
