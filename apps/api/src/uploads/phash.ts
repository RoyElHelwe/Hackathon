import sharp from 'sharp';

/** Two photos whose average hashes differ by at most this many bits are "the same picture" (DECISIONS.md). */
export const COPY_THRESHOLD = 5;

/**
 * 64-bit average hash (aHash) as 16 hex chars: shrink to 8×8 grayscale,
 * each bit = pixel brighter than the mean. Robust to re-encoding and resizing.
 */
export async function averageHash(buf: Buffer): Promise<string> {
  const px = await sharp(buf).rotate().resize(8, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
  const values = Array.from(px.subarray(0, 64));
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (values[i + j] > mean ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two hex hashes. Hashes of different length never match. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += Number.isNaN(x) ? 4 : POPCOUNT[x];
  }
  return d;
}
