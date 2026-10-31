import { passwordStrength } from './passwordStrength';

describe('fortaleza de la contraseña', () => {
  it.each([
    ['corta', 0],
    ['1234567890', 1],
    ['password123', 1],
    ['aaaaaaaaaaaa', 1],
    ['solominusculas', 1],
    ['minusculasy1234x', 2],
    ['clave2segura', 2],
    ['Clave2-Segura', 3],
    ['Una frase Larga 2', 3],
  ])('%s → nivel %i', (password, level) => {
    expect(passwordStrength(password)).toBe(level);
  });
});
