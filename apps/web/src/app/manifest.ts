import type { MetadataRoute } from "next";
import { safeGet } from "@/lib/api/client";
import { cdnImageUrl } from "@/lib/image-url";

// Without this the route is dynamic: it awaits safeGet, so Next served it
// with `max-age=0, must-revalidate` and `cf-cache-status: DYNAMIC`, hitting
// the backend on EVERY page load. Measured on production it was 414 ms and
// the single longest chain in the trace — for a 400-byte JSON file whose
// contents change when an admin edits the site name or favicon, i.e. almost
// never. A day is the right cadence for site identity.
export const revalidate = 86400;

// Site identity — what browsers/OS actually use for bookmarks, tab groups,
// and "Add to Home Screen"/PWA install, beyond just the <link rel="icon">
// in the tab itself. Same admin-configured name/favicon the header/tab icon
// already use (Settings > Logo & Banners > Favicon), so there's one source
// of truth rather than a second hardcoded identity living only here.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { data: siteInfo } = await safeGet("/api/v1/settings/site");
  const name = siteInfo?.siteName ?? "আমাদের";
  // Through the CDN loader, like every other image on the site. The raw
  // value is whatever the admin uploaded — on production it was a legacy
  // pub-*.r2.dev URL pointing at a full-size PNG, served unresized as the
  // install/home-screen icon. 512 is the largest size a PWA install prompt
  // actually uses.
  const rawIconUrl = siteInfo?.faviconUrl ?? "/favicon-default.png";
  const iconUrl = cdnImageUrl(rawIconUrl, 512);

  return {
    name,
    short_name: name,
    description: "আমাদের — organic & natural products",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f1",
    // Matches the storefront header's own nav-bar green (packages/ui's
    // --header-green) — the color mobile browser chrome/the OS splash
    // screen tints itself with, so it reads as the same brand on the way in.
    theme_color: "#21713d",
    icons: [
      // Real pixel size unknown here — it's whatever the admin uploaded
      // (Settings recommends 32x32/64x64, but nothing enforces it) —
      // "any" is the correct declaration for a single icon of unverified
      // size rather than guessing/lying about dimensions.
      //
      // No `type` either, and that is deliberate rather than an omission:
      // the CDN loader uses format=auto, so the bytes come back as AVIF,
      // WebP or PNG depending on what the requesting client accepts.
      // Declaring "image/png" would be a claim we cannot keep, and the
      // field is optional precisely for this case.
      { src: iconUrl, sizes: "any" },
    ],
  };
}
