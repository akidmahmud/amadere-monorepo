export interface SeoScoreInput {
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug: string;
  primaryImageAlt?: string | null;
  description?: string | null;
}

export interface SeoCheck {
  label: string;
  passed: boolean;
}

// Deterministic, rule-based scoring — no AI/LLM involved by design. Six
// checks, each worth an equal share of 100, mirroring the reference design's
// checklist (keyword-in-title/description/URL, image alt text, meta
// description length, content readability). This schema has no "target
// keyword" concept to literally match against, so those checks are
// approximated as "the field is populated with a reasonable length."
export function computeSeoChecks(input: SeoScoreInput): SeoCheck[] {
  const titleLen = input.metaTitle?.trim().length ?? 0;
  const descLen = input.metaDescription?.trim().length ?? 0;
  const bodyLen = input.description?.trim().length ?? 0;
  return [
    { label: 'Title set', passed: titleLen >= 10 && titleLen <= 65 },
    { label: 'Meta description set', passed: descLen >= 50 && descLen <= 160 },
    { label: 'SEO-friendly URL', passed: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) },
    { label: 'Image alt text', passed: !!input.primaryImageAlt?.trim() },
    { label: 'Meta description present', passed: descLen > 0 },
    { label: 'Content readability', passed: bodyLen >= 80 },
  ];
}

export function computeSeoScore(input: SeoScoreInput): number {
  const checks = computeSeoChecks(input);
  const passed = checks.filter((c) => c.passed).length;
  return Math.round((passed / checks.length) * 100);
}
