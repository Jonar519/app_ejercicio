import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, fromKg, isValidWeightKg, toKg } from './units';

describe('conversión de peso', () => {
  it('convierte valores conocidos', () => {
    expect(toKg(180, 'lb')).toBe(81.65);
    expect(fromKg(81.65, 'lb')).toBe(180);
    expect(toKg(70.5, 'kg')).toBe(70.5);
    expect(fromKg(70.5, 'kg')).toBe(70.5);
  });

  it('una entrada en lb con un decimal se recupera exacta en todo el rango', () => {
    for (let tenths = 450; tenths <= 8800; tenths += 1) {
      const pounds = tenths / 10;
      expect(fromKg(toKg(pounds, 'lb'), 'lb')).toBe(pounds);
    }
  });

  it('no acumula pérdida al reconvertir repetidamente', () => {
    const initialKg = toKg(173.3, 'lb');
    let weightKg = initialKg;
    for (let round = 0; round < 1000; round += 1) {
      weightKg = toKg(fromKg(weightKg, 'lb'), 'lb');
    }
    expect(weightKg).toBe(initialKg);
  });

  it('valida el rango de 20 a 400 kg', () => {
    expect(isValidWeightKg(MIN_WEIGHT_KG)).toBe(true);
    expect(isValidWeightKg(MAX_WEIGHT_KG)).toBe(true);
    expect(isValidWeightKg(19.99)).toBe(false);
    expect(isValidWeightKg(400.01)).toBe(false);
    expect(isValidWeightKg(Number.NaN)).toBe(false);
  });
});
