import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@amader/ui", "@amader/page-builder"],
  // PERF-BRIEF.md §4/§5.
  //
  // ⚠️ Resizing must NEVER run on the origin. Next's *built-in* optimizer
  // downloads each image from R2, re-encodes it per requested width/format,
  // and serves it from `/_next/image` — all on this single VPS. Enabling that
  // (briefly, with AVIF on top — roughly 10-50x more CPU than WebP per
  // encode) moved every image request off Cloudflare's CDN and onto the box.
  // Under real ad traffic that saturated it and the whole site stopped
  // loading on mobile data, not just images, since the same process serves
  // the HTML. It never "finishes" either: encoding is on-demand per
  // (image × width × format), and every deploy rebuilds .next and starts the
  // cache over.
  //
  // The previous state was `unoptimized: true`, which kept the origin safe by
  // doing no resizing at all — browsers downloaded the raw upload. Measured
  // on the live homepage: the hero was a 1.77 MB PNG, which on Bangladeshi
  // mobile data is essentially the whole LCP budget spent on one image.
  //
  // This is the third option the old comment called for: a custom loader
  // pointing at Cloudflare Image Resizing, so resizing happens at the edge.
  // Zero origin CPU — the failure mode above cannot recur — and that same
  // hero comes down to 14.8 KB of AVIF at 800px wide.
  //
  // Requires the R2 bucket to be served from the cdn.amadere.com custom
  // domain (on the Cloudflare zone) — the loader rewrites legacy pub-*.r2.dev
  // URLs to it, since /cdn-cgi/image/ does not exist on r2.dev.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudflare-image-loader.ts",
    // Next's default deviceSizes run to 3840, so every responsive image
    // offered 8 srcset candidates and the homepage carried 1,601 candidate
    // URLs — markup the browser parses on every load.
    //
    // The widest container on the site is max-w-[1920px], so 2048 and 3840
    // could only ever be chosen by a display wider than the layout itself.
    // Dropping them removes two candidates per responsive image with no
    // change to what any real viewport actually downloads.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.amadere.com" },
      {
        protocol: "https",
        hostname: "pub-51174804638049198acba5bbf211435e.r2.dev",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
