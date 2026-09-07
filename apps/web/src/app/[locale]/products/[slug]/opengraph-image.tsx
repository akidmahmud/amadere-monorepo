import { ImageResponse } from "next/og";
import { api, ApiError } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { cdnOgBackdropUrl, cdnSquareImageUrl, OG_IMAGE } from "@/lib/image-url";

/**
 * The share card Facebook, WhatsApp and X actually render.
 *
 * Every scraper draws a link preview at 1.91:1, and it crops whatever it is
 * given to that shape. Every product photo in this catalogue is square
 * (measured: 14/14 at 1:1), so a square handed straight over loses 47% of its
 * height — the top and bottom of the jar, which is where the label is.
 *
 * The three one-setting fixes each break something:
 *   - `fit=cover`   crops, which is the bug this replaces
 *   - `fit=pad`     shows the full photo but leaves hard white bars down both
 *                   sides of any shot not taken on white. Sampled across the
 *                   live catalogue, 5 of 14 product photos have a clearly
 *                   coloured border (green 154,192,161 / olive 126,134,100 /
 *                   tan 190,173,137), so padding is invisible on roughly two
 *                   thirds of the catalogue and obvious on the rest.
 *   - stretching    squashes a square jar to 52% height.
 *
 * So the photo is drawn twice instead: once filling the whole 1200x630 (the
 * crop, used only as backdrop) and once complete on top. A `cover` crop of a
 * square keeps the FULL WIDTH and trims height, so the strips left visible
 * either side of the centred photo are that photo's own outer edges — its
 * real background, whatever colour it happens to be. No white, nothing
 * cropped, and no per-image colour to store or backfill.
 */
export const alt = "Amader product";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
// ImageResponse always encodes PNG — declaring jpeg here published a
// wrong og:image:type to every scraper.
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  // A Promise, exactly as in this route's page.tsx — Next 15+ made every
  // route param async. Destructuring it directly yields undefined for both
  // fields, the product fetch then 404s, and the card silently renders as
  // the flat fallback colour instead of the product.
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  let ogImageUrl: string | undefined;
  try {
    const res = await api.GET("/api/v1/products/{slug}", {
      params: { path: { slug }, query: { locale: toApiLocale(locale) } },
    });
    ogImageUrl = res.data?.seo?.ogImageUrl ?? undefined;
  } catch (err) {
    // A card is decoration; a 500 here would break the page's whole metadata
    // render. Anything that is not a clean 404 still falls through to the
    // plain background below.
    if (!(err instanceof ApiError)) throw err;
  }

  // Nothing to draw. A flat brand-coloured card still beats a broken image
  // icon in the scraper's preview.
  if (!ogImageUrl || !/^https?:\/\//.test(ogImageUrl)) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#12261a",
          }}
        />
      ),
      size,
    );
  }

  // Both layers are pre-sized by the CDN so satori only has to place them —
  // it never scales or fits anything, which is where aspect bugs come from.
  const backdrop = cdnOgBackdropUrl(ogImageUrl);
  const full = cdnSquareImageUrl(ogImageUrl, OG_IMAGE.height);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdrop}
          alt=""
          width={OG_IMAGE.width}
          height={OG_IMAGE.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={full}
          alt=""
          width={OG_IMAGE.height}
          height={OG_IMAGE.height}
          style={{
            position: "absolute",
            top: 0,
            left: (OG_IMAGE.width - OG_IMAGE.height) / 2,
          }}
        />
      </div>
    ),
    size,
  );
}
