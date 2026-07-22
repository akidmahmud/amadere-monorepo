// Client-side mirror of apps/backend/.../seo-score.util.ts — duplicated
// (not imported) because it's small, pure logic with no DB access, and
// needs to run on every keystroke for live feedback without a network
// round-trip. Deterministic, rule-based — no AI involved.
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
    { label: "Title set", passed: titleLen >= 10 && titleLen <= 65 },
    { label: "Meta description set", passed: descLen >= 50 && descLen <= 160 },
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
