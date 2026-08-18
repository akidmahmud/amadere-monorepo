import path from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(tailwindcss());
    // Several components now import next/image (PERF-BRIEF.md §4) — Storybook's
    // plain Vite build has no Next.js image-optimization route for it to call,
    // so it errors here. Swapped for a plain-<img> shim in this build only;
    // see next-image-shim.tsx.
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      "next/image": path.resolve(__dirname, "next-image-shim.tsx"),
    };
    return viteConfig;
  },
};

export default config;
