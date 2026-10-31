// Genera public/icons (SVG fuente y PNG) sin dependencias: dibuja una mancuerna con rectángulos
// redondeados y codifica el PNG con zlib.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUTPUT = 'public/icons';
const BASE = 512;
const SAMPLES = 4;
const BACKGROUND = [4, 120, 87]; // emerald-700
const FOREGROUND = [255, 255, 255];
const CORNER_RADIUS = 112;

/** Mancuerna sobre un lienzo de 512: cabe en la zona segura de un icono maskable. */
const SHAPES = [
  { x: 150, y: 236, width: 212, height: 40, radius: 8 },
  { x: 118, y: 170, width: 44, height: 172, radius: 14 },
  { x: 350, y: 170, width: 44, height: 172, radius: 14 },
  { x: 74, y: 206, width: 36, height: 100, radius: 12 },
  { x: 402, y: 206, width: 36, height: 100, radius: 12 },
];

const inRoundedRect = (px, py, { x, y, width, height, radius }) => {
  const dx = Math.max(x + radius - px, px - (x + width - radius), 0);
  const dy = Math.max(y + radius - py, py - (y + height - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
};

const CANVAS = { x: 0, y: 0, width: BASE, height: BASE, radius: CORNER_RADIUS };

const samplePixel = (px, py, fullBleed) => {
  if (!fullBleed && !inRoundedRect(px, py, CANVAS)) return null;
  return SHAPES.some((shape) => inRoundedRect(px, py, shape)) ? FOREGROUND : BACKGROUND;
};

/** Devuelve RGBA con antialias por supermuestreo. */
const render = (size, fullBleed) => {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = BASE / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let [red, green, blue, covered] = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const color = samplePixel(
            (x + (sx + 0.5) / SAMPLES) * scale,
            (y + (sy + 0.5) / SAMPLES) * scale,
            fullBleed,
          );
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          covered += 1;
        }
      }
      const offset = (y * size + x) * 4;
      if (covered > 0) {
        pixels[offset] = Math.round(red / covered);
        pixels[offset + 1] = Math.round(green / covered);
        pixels[offset + 2] = Math.round(blue / covered);
        pixels[offset + 3] = Math.round((covered / SAMPLES ** 2) * 255);
      }
    }
  }
  return pixels;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

const encodePng = (size, pixels) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const toHex = (color) => `#${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`;

const svg = () => {
  const rects = SHAPES.map(
    ({ x, y, width, height, radius }) =>
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${toHex(FOREGROUND)}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BASE} ${BASE}"><rect width="${BASE}" height="${BASE}" rx="${CORNER_RADIUS}" fill="${toHex(BACKGROUND)}"/>${rects}</svg>\n`;
};

const ICONS = [
  { name: 'icon-192.png', size: 192, fullBleed: false },
  { name: 'icon-512.png', size: 512, fullBleed: false },
  { name: 'icon-maskable-192.png', size: 192, fullBleed: true },
  { name: 'icon-maskable-512.png', size: 512, fullBleed: true },
  { name: 'apple-touch-icon.png', size: 180, fullBleed: true },
];

mkdirSync(OUTPUT, { recursive: true });
writeFileSync(`${OUTPUT}/icon.svg`, svg());
for (const { name, size, fullBleed } of ICONS) {
  writeFileSync(`${OUTPUT}/${name}`, encodePng(size, render(size, fullBleed)));
}
