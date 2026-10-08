// Generates PWA icons from the Bousla SVG. Run: node scripts/make-icons.cjs
const path = require('node:path');
const fs = require('node:fs');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../apps/api')] }));

const dir = path.join(__dirname, '../apps/web/public/icons');
const svg = fs.readFileSync(path.join(dir, 'bousla.svg'));

async function icon(size, file, { pad = 0.1, bg = '#FAF8FF' } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const mascot = await sharp(svg, { density: 600 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mascot, gravity: 'center' }])
    .png()
    .toFile(path.join(dir, file));
}

(async () => {
  await icon(192, 'icon-192.png');
  await icon(512, 'icon-512.png');
  await icon(512, 'maskable-512.png', { pad: 0.2, bg: '#ECE7FF' });
  await icon(180, 'apple-touch-icon.png', { pad: 0.12 });
  console.log('icons written to', dir);
})();
