import { displayNameSchema, settingsSchema } from './schemas';

const validSettings = {
  weight_unit: 'kg',
  daily_calorie_goal: 2000,
  rest_between_sets_seconds: 45,
  rest_between_exercises_seconds: 60,
  sound_enabled: true,
  vibration_enabled: false,
};

describe('validación del perfil', () => {
  it('recorta el nombre y limita su longitud', () => {
    expect(displayNameSchema.parse('  Ana  ')).toBe('Ana');
    expect(displayNameSchema.safeParse('x'.repeat(50)).success).toBe(true);
    expect(displayNameSchema.safeParse('x'.repeat(51)).success).toBe(false);
  });

  it('acepta preferencias válidas', () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it.each([
    ['weight_unit', 'st'],
    ['daily_calorie_goal', 0],
    ['daily_calorie_goal', 20001],
    ['daily_calorie_goal', Number.NaN],
    ['rest_between_sets_seconds', 4],
    ['rest_between_exercises_seconds', 601],
    ['rest_between_sets_seconds', 10.5],
  ])('rechaza %s = %s', (field, value) => {
    expect(settingsSchema.safeParse({ ...validSettings, [field]: value }).success).toBe(false);
  });
});
