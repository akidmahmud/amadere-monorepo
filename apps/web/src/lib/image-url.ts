// Single definition of how an image URL becomes a CDN URL.
//
// Used by two callers that must never disagree:
//   - cloudflare-image-loader.ts, for components rendering through next/image
//   - toDisplayImageUrl() in media.ts, for the ~54 places that render a raw
//     <img> and so never reach the loader at all
//
// The raw <img> path is not an edge case. Measured on the live homepage: the
// site logo was a 1,773,628-byte PNG displayed at max-h-[56px] — about 150x
// larger than the pixels it occupies — because it bypassed every optimisation
// the app has. It alone was ~72% of the page's image bytes.

/** The R2 bucket's custom domain. Must be on the Cloudflare zone — that is
 *  what makes /cdn-cgi/image/ available on this host at all. */
const CDN_HOST = "cdn.amadere.com";

/**
 * Historic uploads were stored with R2's public dev URL rather than the
 * custom domain, and those absolute URLs are baked into existing database
 * rows. That host is NOT on the Cloudflare zone, so /cdn-cgi/image/ does not
 * exist there — and Cloudflare documents r2.dev as rate-limited and
 * unsuitable for production traffic besides.
 *
 * Rewriting the host here fixes every one of those rows at render time
 * without a data migration. Matching any *.r2.dev host rather than the one
 * bucket id keeps this working if the bucket is ever recreated.
 */
const R2_DEV_HOST = /^https:\/\/[a-z0-9-]+\.r2\.dev/i;

/**
 * Rewrites an image URL to be served resized from the CDN edge.
 *
 * Returns the input untouched for local assets (/images/…), data URIs, and
 * any host we do not control — those must keep working exactly as before.
 *
 * `fit=scale-down` never upscales: asking for 1280 on a 400px source returns
 * the 400px original rather than a blown-up copy that costs more and looks
 * worse. That makes a generous default width safe.
 */
export function cdnImageUrl(src: string, width: number, quality = 75): string {
  return withCdnParams(src, `width=${width},quality=${quality},format=auto,fit=scale-down`);
}

/** The size every social scraper is happiest with, and the one Facebook's
 *  sharing debugger measures against (it rejects anything under 200x200). */
export const OG_IMAGE = { width: 1200, height: 630 } as const;

/**
 * The blurred backdrop layer of the generated product share card.
 *
 * Same `fit=cover` crop the card used to ship on its own, but blurred hard
 * and used only as filler behind the real image. Blur is not decoration: the
 * product artwork here is not a plain photo on a neutral sweep, it is a
 * finished creative with Bengali headline text running the full width. Drawn
 * sharp, the strips either side of the centred image showed enlarged
 * fragments of that same text — a visible ghosted duplicate, worse than the
 * white bars this replaces. Blurred, they read as a soft colour wash taken
 * from the photo's own palette.
 *
 * Cloudflare blurs at the edge (`blur=1..250`), so this costs no extra
 * compute here and the blurred result compresses far smaller than the sharp
 * one it replaces.
 */
export function cdnOgBackdropUrl(src: string): string {
  return withCdnParams(
    src,
    `width=${OG_IMAGE.width},height=${OG_IMAGE.height},quality=70,format=jpeg,fit=cover,blur=120`,
  );
}

/**
 * An exact NxN square of the source, whole — nothing cropped away.
 *
 * The foreground layer of the generated product share card (see the product
 * route's opengraph-image.tsx). `fit=pad` and not `contain` on purpose:
 * `contain` returns a box that is only as big as the image fits into, so a
 * non-square source would come back smaller than N and then get stretched by
 * whatever places it. Padding guarantees exactly NxN. The padding itself is
 * never seen on a square source (all product photos are), and where a source
 * is not square the card's own backdrop layer sits behind it anyway.
 */
export function cdnSquareImageUrl(src: string, size: number): string {
  return withCdnParams(
    src,
    `width=${size},height=${size},quality=88,format=jpeg,fit=pad,background=%23ffffff`,
  );
}

/**
 * A share-card image: always exactly 1200x630, whatever was uploaded.
 *
 * Not `cdnImageUrl`. That uses `fit=scale-down`, which never upscales — right
 * for page images, wrong here. A 150x150 category thumbnail came back as
 * 150x150 and Facebook refused it outright ("did not meet the minimum size
 * constraint of 200px by 200px"), which means no share card at all rather than
 * a slightly soft one.
 *
 * `fit=pad` is deliberate over `cover`: it scales the whole image to fit and
 * fills the rest with white, so a square logo is centred on a card instead of
 * having its top and bottom cropped away to make 1.91:1.
 *
 * `format=jpeg` rather than `auto`, because `auto` keys off the requester's
 * Accept header and scrapers commonly send `*​/*`. JPEG is the one format every
 * scraper renders; og:image is not a bandwidth-sensitive path.
 */
export function cdnOgImageUrl(src: string, fit: 'pad' | 'cover' = 'pad'): string {
  // `cover` fills the 1.91:1 card by cropping; `pad` letterboxes onto white.
  //
  // Which is right depends entirely on the source. Measured on two real
  // product photos, both square, both padded identically: the one shot on a
  // near-white background (rgb 221,220,214) hid the bars completely, while
  // the one on a brown background (rgb 158,136,126) showed a hard white gap
  // down each side. Padding is not "safe by default" — it is only invisible
  // on white-background photography.
  const fill =
    fit === 'cover' ? 'fit=cover' : 'fit=pad,background=%23ffffff';
  return withCdnParams(
    src,
    `width=${OG_IMAGE.width},height=${OG_IMAGE.height},quality=85,format=jpeg,${fill}`,
  );
}

function withCdnParams(src: string, params: string): string {
  if (!src) return src;

  const normalised = src.replace(R2_DEV_HOST, `https://${CDN_HOST}`);
  if (!normalised.startsWith(`https://${CDN_HOST}/`)) return src;

  // Already transformed. This happens legitimately: a mapper wraps the URL
  // for the raw-<img> case, and then a component renders it through
  // next/image, whose loader wraps it again. Nesting would 404, and simply
  // returning the first version would pin every srcset entry to one width —
  // silently undoing responsive sizing. Replacing the parameters lets the
  // last caller win, which is the one that actually knows the render width.
  const marker = "/cdn-cgi/image/";
  if (normalised.includes(marker)) {
    const at = normalised.indexOf(marker) + marker.length;
    const rest = normalised.slice(at);
    const slash = rest.indexOf("/");
    return `https://${CDN_HOST}${marker}${params}${rest.slice(slash)}`;
  }

  // The path is otherwise kept exactly as-is: several existing keys contain
  // percent-encoded spaces and commas from their original filenames, and
  // re-encoding them would 404.
  //
  // The one exception is a LITERAL space, which some uploads have in their key
  // ("…-ChatGPT Image Jul 23, 2026, 11_21_08 AM.png"). A raw space is never
  // valid in a URL, so encoding it cannot damage an already-encoded path — and
  // leaving it in produces a URL that curl and social scrapers refuse outright
  // (measured: the raw form fails to resolve, the encoded form returns 200).
  const path = normalised.slice(`https://${CDN_HOST}`.length).replace(/ /g, "%20");
  return `https://${CDN_HOST}/cdn-cgi/image/${params}${path}`;
}

/**
 * Widths for the raw-<img> call sites, named by role rather than by number so
 * the intent survives a redesign. Each is roughly 2x the CSS size it renders
 * at, which covers retina without paying for more.
 */
export const IMG = {
  /** Header/footer logos — rendered at max-h 56-72px. */
  logo: 320,
  /** Avatars, payment marks, small badges. */
  icon: 128,
  /** Certification marks, brand logos in a row. */
  badge: 256,
  /** Product/blog thumbnails in a list or cart line. */
  thumb: 400,
  /** Cards in a grid. */
  card: 640,
  /** Full-width banners and hero art. */
  banner: 1600,
  /** Anything whose size is not known at the call site. */
  default: 1280,
} as const;
