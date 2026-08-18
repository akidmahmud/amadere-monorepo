import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@amader/ui"],
  // PERF-BRIEF.md §4/§5 — next/image needs every remote host it'll ever be
  // asked to optimize explicitly allow-listed. cdn.amadere.com is the new
  // custom domain bound to the R2 bucket (replaces the throttled, not-for-
  // production *.r2.dev dev endpoint — R2_PUBLIC_BASE_URL on the backend
  // controls which one *new* uploads get). The r2.dev host stays allow-
  // listed too — existing DB rows still hold old r2.dev URLs (same bucket,
  // still resolves) until/unless those get rewritten.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.amadere.com" },
      { protocol: "https", hostname: "pub-51174804638049198acba5bbf211435e.r2.dev" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
