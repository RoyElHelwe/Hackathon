// Generates the PWA icons from the Arzino "cheer" sticker. Run: node scripts/make-icons.cjs
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../apps/api')] }));

const web = path.join(__dirname, '../apps/web/public');
const src = path.join(web, 'arzino/cheer.webp');

async function icon(size, pad, file, background) {
  const inner = Math.round(size * (1 - pad * 2));
  const mascot = await sharp(src).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } }).composite([{ input: mascot, gravity: 'center' }]).png().toFile(file);
}

(async () => {
  const soft = '#E2F5EA';
  await icon(192, 0.06, path.join(web, 'icons/icon-192.png'), soft);
  await icon(512, 0.06, path.join(web, 'icons/icon-512.png'), soft);
  await icon(512, 0.16, path.join(web, 'icons/maskable-512.png'), soft);
  await icon(180, 0.08, path.join(web, 'icons/apple-touch-icon.png'), soft);
  await icon(64, 0.02, path.join(web, 'arzino/favicon.png'), { r: 0, g: 0, b: 0, alpha: 0 });
  console.log('icons written');
})();
