import {
  MAX_AVATAR_DIMENSION,
  MAX_AVATAR_INPUT_BYTES,
  avatarPath,
  scaledSize,
  validateAvatarFile,
} from './avatar';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const fileOf = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

describe('validación del avatar', () => {
  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.JPEG', 'image/jpeg'],
    ['foto.png', 'image/png'],
    ['foto.webp', 'image/webp'],
  ])('acepta %s', (name, type) => {
    expect(validateAvatarFile(fileOf(name, type))).toBeNull();
  });

  it.each([
    ['foto.gif', 'image/gif'],
    ['vector.svg', 'image/svg+xml'],
    ['pagina.html', 'text/html'],
    ['falsa.png', 'text/html'],
    ['falsa.html', 'image/png'],
    ['sin-extension', 'image/png'],
  ])('rechaza %s (%s)', (name, type) => {
    expect(validateAvatarFile(fileOf(name, type))).toMatch(/JPEG, PNG o WebP/);
  });

  it('rechaza archivos demasiado grandes', () => {
    const file = fileOf('foto.png', 'image/png', MAX_AVATAR_INPUT_BYTES + 1);
    expect(validateAvatarFile(file)).toMatch(/10 MB/);
  });
});

describe('redimensionado', () => {
  it('limita el lado mayor conservando la proporción', () => {
    expect(scaledSize(4000, 2000)).toEqual({ width: MAX_AVATAR_DIMENSION, height: 256 });
    expect(scaledSize(1000, 2000)).toEqual({ width: 256, height: MAX_AVATAR_DIMENSION });
  });

  it('no amplía imágenes pequeñas', () => {
    expect(scaledSize(100, 50)).toEqual({ width: 100, height: 50 });
  });
});

describe('nombre del archivo', () => {
  it('es un UUID dentro de la carpeta del usuario', () => {
    expect(avatarPath(USER_ID, 'image/webp')).toMatch(new RegExp(`^${USER_ID}/${UUID}\\.webp$`));
    expect(avatarPath(USER_ID, 'image/jpeg')).toMatch(new RegExp(`^${USER_ID}/${UUID}\\.jpg$`));
  });

  it('no se repite', () => {
    expect(avatarPath(USER_ID, 'image/webp')).not.toBe(avatarPath(USER_ID, 'image/webp'));
  });
});
