import sharp from 'sharp';

// WordPress-style derivative generation on upload — a fixed "card" size for
// grid/list thumbnails and a "full" size capped for PDP/hero placements,
// both re-encoded to WebP regardless of source format. Live audit (PSI
// Lighthouse, Aug 2026) flagged 10.7MB/6.25MB of avoidable image weight on
// the storefront homepage alone — this is the fix. `withoutEnlargement`
// means a source image smaller than the target width is left at its own
// size rather than upscaled and blurred.
const CARD_WIDTH = 400;
// 1200 was under-serving every full-bleed placement on the site: the hero is
// documented at 1882px, the ad banner 1690px and the newsletter banner
// 1600px, so a stored 1200px file was being UPSCALED into all three and
// looked soft. Measured on the newsletter banner: served 1200x375 into a
// 1392x435 box.
//
// Raising it costs storage, not user bandwidth — every placement fetches
// through `cdn-cgi/image/width=...`, so this file is only the SOURCE the CDN
// resizes from, and a shopper still downloads a per-placement size.
const FULL_MAX_WIDTH = 1920;
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
