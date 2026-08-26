import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @amader/ui is here for the footer editor's live preview, which renders
  // the real storefront Footer rather than an admin-side mock. Both packages
  // ship raw .ts/.tsx from src (see their package.json "main"), so Next has
  // to transpile them itself.
  transpilePackages: ["@amader/admin-ui", "@amader/ui", "@amader/page-builder"],
};

export default nextConfig;
