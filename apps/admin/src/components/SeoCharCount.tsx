"use client";

import { SEO_LIMITS } from "@/lib/seo-score";

// Shown under every meta title / meta description input. The SEO score card
// was already grading these lengths (computeSeoChecks) but nothing on the
// field itself said what the target was, so authors saw the score drop with
// no explanation — reported as "it doesn't show what the limit is".
//
// Ranges come from SEO_LIMITS, the same constants the score uses, so the
// hint and the grade can never disagree. Trimmed length, matching how
// computeSeoChecks measures it — otherwise trailing whitespace would show
// as "in range" here while the score counted it as short.
export function SeoCharCount({ value, limit }: { value: string; limit: keyof typeof SEO_LIMITS }) {
  const { min, max } = SEO_LIMITS[limit];
  const length = value.trim().length;
  // Empty is "not started", not "too short" — an untouched optional field
  // shouldn't shout in red before anyone has typed in it.
  const state = length === 0 ? "empty" : length < min ? "short" : length > max ? "over" : "ok";
  const tone =
    state === "ok" ? "text-success" : state === "over" ? "text-danger" : state === "short" ? "text-warning" : "text-muted";
  const hint =
    state === "over"
      ? `${length - max} over the limit`
      : state === "short"
        ? `${min - length} more for the ideal range`
        : null;

  return (
    <span className={`text-[11px] font-semibold ${tone}`}>
      {length} / {min}–{max} characters{hint ? ` · ${hint}` : ""}
    </span>
  );
}
