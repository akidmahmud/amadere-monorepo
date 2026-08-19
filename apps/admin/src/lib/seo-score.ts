// Client-side mirror of apps/backend/.../seo-score.util.ts — duplicated
// (not imported) because it's small, pure logic with no DB access, and
// needs to run on every keystroke for live feedback without a network
// round-trip. Deterministic, rule-based — no AI involved. Shared by
// ProductSeoTab and SeoMetaCard (categories/collections/etc).
// The ranges the checks below already grade against, hoisted into named
// constants so the input fields can SHOW them (SeoCharCount) instead of
// leaving an author to guess what the score is silently marking them down
// for — the reported confusion was "it doesn't show what the limit is".
// One definition, so a field's hint can never drift from the rule that
// scores it.
//
// Maxima raised from 65/160 to 200/450 at the product owner's request. Worth
// knowing when reading this: the old numbers were the SERP-truncation
// figures (Google renders roughly the first ~60 characters of a title and
// ~160 of a description before cutting), so text past those still won't
// SHOW in a search result — these are now "how much this site wants to
// store", not "how much Google displays". Kept in sync with the server-side
// mirror in apps/backend/src/modules/products/seo-score.util.ts; change both
// or the stored product SEO score will contradict the hint on the field.
export const SEO_LIMITS = {
  title: { min: 10, max: 200 },
  description: { min: 50, max: 450 },
} as const;

export interface SeoCheck {
  label: string;
  passed: boolean;
}

export function computeSeoChecks(input: {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  primaryImageAlt: string;
  description: string;
}): SeoCheck[] {
  const titleLen = input.metaTitle.trim().length;
  const descLen = input.metaDescription.trim().length;
  const bodyLen = input.description.trim().length;
  return [
    { label: "Title set", passed: titleLen >= SEO_LIMITS.title.min && titleLen <= SEO_LIMITS.title.max },
    { label: "Meta description set", passed: descLen >= SEO_LIMITS.description.min && descLen <= SEO_LIMITS.description.max },
    { label: "SEO-friendly URL", passed: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) },
    { label: "Image alt text", passed: !!input.primaryImageAlt.trim() },
    { label: "Meta description present", passed: descLen > 0 },
    { label: "Content readability", passed: bodyLen >= 80 },
  ];
}

export function computeSeoScore(checks: SeoCheck[]): number {
  const passed = checks.filter((c) => c.passed).length;
  return Math.round((passed / checks.length) * 100);
}
