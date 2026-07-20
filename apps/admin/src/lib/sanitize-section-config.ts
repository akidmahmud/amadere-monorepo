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
  if (type === "TESTIMONIAL_BENTO") {
    const videos = Array.isArray(config.videos) ? config.videos.filter((v) => v?.url) : config.videos;
    const reviews = Array.isArray(config.reviews) ? config.reviews.filter((r) => r?.quote && r?.name) : config.reviews;
    return { ...config, videos, reviews };
  }
  if (type === "CERTIFICATION_ROW" && Array.isArray(config.items)) {
    return { ...config, items: config.items.filter((item) => item?.imageUrl) };
  }
  return config;
}
