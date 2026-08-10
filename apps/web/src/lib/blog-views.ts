// One cookie per post ("bv_<id>"), not a single JSON blob like utm.ts — a
// reader working through a back-catalog of posts over 30 days would need
// an eviction scheme to keep one shared cookie under the ~4KB limit; a
// bare "1" per post needs none, and self-expires via maxAge instead.
const COOKIE_PREFIX = "bv_";
const MAX_AGE_DAYS = 30;

export function hasViewedBlogPost(postId: number): boolean {
  if (typeof document === "undefined") return true; // SSR/prerender — never the real visitor, don't count it
  return new RegExp(`(?:^|; )${COOKIE_PREFIX}${postId}=1(?:;|$)`).test(document.cookie);
}

export function markBlogPostViewed(postId: number): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_PREFIX}${postId}=1; expires=${expires}; path=/; SameSite=Lax`;
}
