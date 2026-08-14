import sharp from 'sharp';

// WordPress-style derivative generation on upload — a fixed "card" size for
// grid/list thumbnails and a "full" size capped for PDP/hero placements,
// both re-encoded to WebP regardless of source format. Live audit (PSI
// Lighthouse, Aug 2026) flagged 10.7MB/6.25MB of avoidable image weight on
// the storefront homepage alone — this is the fix. `withoutEnlargement`
// means a source image smaller than the target width is left at its own
// size rather than upscaled and blurred.
const CARD_WIDTH = 400;
const FULL_MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;

export interface ImageDerivative {
  buffer: Buffer;
  contentType: 'image/webp';
}

export interface ImageDerivatives {
  card: ImageDerivative;
  full: ImageDerivative;
}

// Returns null for anything sharp can't decode (SVG, a corrupt upload) —
// callers fall back to serving the original, unprocessed file.
export async function generateImageDerivatives(buffer: Buffer): Promise<ImageDerivatives | null> {
  try {
    const [card, full] = await Promise.all([
      sharp(buffer).rotate().resize({ width: CARD_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
      sharp(buffer).rotate().resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    ]);
    return {
      card: { buffer: card, contentType: 'image/webp' },
      full: { buffer: full, contentType: 'image/webp' },
    };
  } catch {
    return null;
  }
}
