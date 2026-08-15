import type { MetadataRoute } from "next";
import { safeGet } from "@/lib/api/client";

// Site identity — what browsers/OS actually use for bookmarks, tab groups,
// and "Add to Home Screen"/PWA install, beyond just the <link rel="icon">
// in the tab itself. Same admin-configured name/favicon the header/tab icon
// already use (Settings > Logo & Banners > Favicon), so there's one source
// of truth rather than a second hardcoded identity living only here.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { data: siteInfo } = await safeGet("/api/v1/settings/site");
  const name = siteInfo?.siteName ?? "আমাদের";
  const iconUrl = siteInfo?.faviconUrl ?? "/favicon-default.png";

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
      { src: iconUrl, sizes: "any", type: "image/png" },
    ],
  };
}
