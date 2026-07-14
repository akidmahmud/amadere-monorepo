import type { HomepageSectionType } from "@/hooks/useHomepageSections";

// Strips slides/items a form could produce mid-edit but that should never be
// persisted — e.g. "Add slide" defaults to `{ imageUrl: "" }` until an image
// is picked; saving that as-is puts an empty `src` on the storefront's
// <img>. Filtering here (once, at submit) beats validating on every
// keystroke in the form itself.
export function sanitizeHomepageSectionConfig(
  type: HomepageSectionType,
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "HERO_BANNER" && Array.isArray(config.slides)) {
    return { ...config, slides: config.slides.filter((slide) => slide?.imageUrl) };
  }
  return config;
}
