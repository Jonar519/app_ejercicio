export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/** Tamaño máximo del archivo elegido, antes de recomprimir. */
export const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_DIMENSION = 512;
export const TARGET_AVATAR_BYTES = 200 * 1024;

const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.25];
const OUTPUT_TYPES = ['image/webp', 'image/jpeg'];

const EXTENSIONS: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

export const validateAvatarFile = (file: File): string | null => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_AVATAR_TYPES.includes(file.type) || !ALLOWED_AVATAR_EXTENSIONS.includes(extension)) {
    return 'Usa una imagen JPEG, PNG o WebP.';
  }
  if (file.size > MAX_AVATAR_INPUT_BYTES) return 'La imagen no puede superar los 10 MB.';
  return null;
};

export const scaledSize = (width: number, height: number) => {
  const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const avatarPath = (userId: string, contentType: string) =>
  `${userId}/${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? 'webp'}`;

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      type,
      quality,
    );
  });

/** Safari no codifica WebP y devuelve PNG: en ese caso se usa JPEG. */
const encodeWithinTarget = async (canvas: HTMLCanvasElement) => {
  for (const type of OUTPUT_TYPES) {
    let smallest: Blob | undefined;
    for (const quality of QUALITY_STEPS) {
      smallest = await encode(canvas, type, quality);
      if (smallest.type === type && smallest.size <= TARGET_AVATAR_BYTES) return smallest;
    }
    if (smallest?.type === type) return smallest;
  }
  throw new Error('No se pudo procesar la imagen');
};

/** Redibuja la imagen en un canvas: el resultado no conserva metadatos EXIF ni GPS. */
export const compressAvatar = async (file: File) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return encodeWithinTarget(canvas);
};
