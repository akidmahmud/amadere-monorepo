import { ImageResponse } from "next/og";
import { api, ApiError } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { cdnSquareImageUrl } from "@/lib/image-url";

/**
 * Preserve the complete square product artwork in social previews. A wide
 * canvas shrinks the product and introduces side panels; cropping cuts off
 * packaging and text. The exported size also supplies og:image dimensions.
 * Social platforms still choose their own preview layout.
 */
export const alt = "Amader product";
export const size = { width: 1080, height: 1080 };
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
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#12261a",
        }}
      />,
      size,
    );
  }

  // Resize at the CDN edge. Square uploads fill the canvas without bars;
  // contain also preserves proportions for an image on an external host.
  const full = cdnSquareImageUrl(ogImageUrl, size.width);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#ffffff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={full}
        alt=""
        width={size.width}
        height={size.height}
        style={{ objectFit: "contain" }}
      />
    </div>,
    size,
  );
}
