import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@amader/ui"],
  // PERF-BRIEF.md §4/§5.
  //
  // ⚠️ `unoptimized: true` is deliberate and load-bearing — DO NOT remove it
  // without a plan for where image resizing actually runs.
  //
  // The components across this app render through next/image (correct sizing
  // attributes, lazy-loading, no layout shift — all still active here). But
  // Next.js's *built-in* optimizer runs on the origin: it downloads each
  // image from R2, re-encodes it per requested width/format, and serves it
  // from `/_next/image`. Enabling that (briefly, with AVIF on top — roughly
  // 10-50x more CPU than WebP per encode) moved every image request off
  // Cloudflare's CDN and onto this single VPS. Under real ad traffic that
  // saturated the box and the whole site stopped loading on mobile data —
  // not just images, since the same process serves the HTML. It never
  // "finishes" either: encoding is on-demand per (image × width × format),
  // and every deploy rebuilds .next and starts the cache over.
  //
  // With `unoptimized`, next/image emits the source URL directly and images
  // are served by Cloudflare in front of R2 again — zero origin CPU.
  //
  // The real fix (better than either state) is edge resizing: point
  // R2_PUBLIC_BASE_URL at the cdn.amadere.com custom domain and use
  // Cloudflare Image Resizing via a custom next/image `loader`, so resizing
  // happens at Cloudflare's edge instead of on this server.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.amadere.com" },
      { protocol: "https", hostname: "pub-51174804638049198acba5bbf211435e.r2.dev" },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
