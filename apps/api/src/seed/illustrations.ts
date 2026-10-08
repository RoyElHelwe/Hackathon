import sharp from 'sharp';

/** Simple illustrated "photos" for seeded submissions (no real photos of people). */
const W = 800;
const H = 600;

const frame = (body: string, bg = '#cfe8ff') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

export const ILLUSTRATIONS: Record<string, string> = {
  shadow: frame(
    `<circle cx="690" cy="90" r="55" fill="#FFC83D"/>
     <rect x="0" y="470" width="800" height="130" fill="#d8c9a8"/>
     <rect x="420" y="140" width="150" height="330" fill="#8a7bd6"/>
     ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 3 }, (_, c) => `<rect x="${440 + c * 45}" y="${165 + r * 50}" width="28" height="30" fill="#fff6c7"/>`).join('')).join('')}
     <polygon points="420,470 570,470 120,560 60,560" fill="#00000055"/>
     <rect x="640" y="400" width="18" height="70" rx="8" fill="#2DD4A7"/>
     <circle cx="649" cy="390" r="14" fill="#f4c7a1"/>
     <polygon points="640,470 658,470 600,505 585,505" fill="#00000055"/>
     <line x1="60" y1="575" x2="420" y2="575" stroke="#FF7A59" stroke-width="6" stroke-dasharray="14 8"/>
     <text x="170" y="560" font-family="Arial" font-size="26" fill="#14112B">S = 18.6 m</text>`,
  ),
  shadow2: frame(
    `<rect x="0" y="420" width="800" height="180" fill="#d8c9a8"/>
     <rect x="360" y="180" width="26" height="240" rx="12" fill="#2DD4A7"/>
     <circle cx="373" cy="160" r="30" fill="#f4c7a1"/>
     <polygon points="360,420 386,420 120,520 80,520" fill="#00000055"/>
     <rect x="80" y="530" width="300" height="22" fill="#FFC83D"/>
     ${Array.from({ length: 15 }, (_, i) => `<line x1="${80 + i * 20}" y1="530" x2="${80 + i * 20}" y2="${i % 5 === 0 ? 552 : 542}" stroke="#14112B" stroke-width="2"/>`).join('')}
     <text x="420" y="500" font-family="Arial" font-size="28" fill="#14112B">h = 1.55 m · s = 2.10 m</text>`,
    '#d6ecff',
  ),
  tiles: frame(
    `${Array.from({ length: 8 }, (_, r) => Array.from({ length: 10 }, (_, c) => `<rect x="${40 + c * 72}" y="${40 + r * 66}" width="70" height="64" fill="${(r + c) % 2 ? '#f3efe6' : '#e2dccd'}"/>`).join('')).join('')}
     <rect x="40" y="560" width="720" height="18" fill="#FFC83D"/>
     <text x="300" y="550" font-family="Arial" font-size="30" fill="#6C4CF1">3.6 m × 3.0 m</text>`,
    '#c9c2b0',
  ),
  balcony: frame(
    `<rect x="60" y="120" width="680" height="380" fill="#efe7d6"/>
     ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 11 }, (_, c) => `<rect x="${60 + c * 62}" y="${120 + r * 63}" width="60" height="61" fill="${(r * 3 + c) % 4 ? '#e9d8b8' : '#d3b98d'}"/>`).join('')).join('')}
     <rect x="60" y="80" width="680" height="30" fill="#7b6a58"/>
     <text x="250" y="560" font-family="Arial" font-size="30" fill="#14112B">4.2 m × 1.5 m = 6.3 m²</text>`,
    '#bfe3ff',
  ),
  stairs: frame(
    `${Array.from({ length: 5 }, (_, i) => `<rect x="${150 + i * 100}" y="${480 - i * 60}" width="${650 - i * 100}" height="${60 + i * 60}" fill="${i % 2 ? '#b7aee6' : '#a49be0'}"/>`).join('')}
     <line x1="150" y1="540" x2="750" y2="540" stroke="#FF7A59" stroke-width="6"/>
     <line x1="760" y1="240" x2="760" y2="540" stroke="#2DD4A7" stroke-width="6"/>
     <text x="300" y="585" font-family="Arial" font-size="28" fill="#14112B">rise 75 cm · run 120 cm</text>`,
    '#f4f0ff',
  ),
  walk: frame(
    `<rect x="0" y="380" width="800" height="220" fill="#9bd67a"/>
     <rect x="0" y="430" width="800" height="70" fill="#d9d2c0"/>
     ${Array.from({ length: 11 }, (_, i) => `<line x1="${40 + i * 72}" y1="465" x2="${70 + i * 72}" y2="465" stroke="#fff" stroke-width="6"/>`).join('')}
     <text x="250" y="560" font-family="Arial" font-size="30" fill="#14112B">50 m in 38 s</text>`,
    '#d6efff',
  ),
};

export async function illustrationJpeg(name: keyof typeof ILLUSTRATIONS | string): Promise<Buffer> {
  return sharp(Buffer.from(ILLUSTRATIONS[name] ?? ILLUSTRATIONS.tiles)).jpeg({ quality: 82 }).toBuffer();
}
