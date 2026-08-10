"use client";

import { computeSeoChecks, computeSeoScore } from "@/lib/seo-score";

// Shared by ProductSeoTab and SeoMetaCard — same ring + checklist, same
// scoring rules, so a category's score means the same thing a product's does.
export function SeoScoreRing({
  metaTitle,
  metaDescription,
  slug,
  primaryImageAlt,
  description,
}: {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  primaryImageAlt: string;
  description: string;
}) {
  const checks = computeSeoChecks({ metaTitle, metaDescription, slug, primaryImageAlt, description });
  const score = computeSeoScore(checks);
  const r = 45;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const ringColor = score >= 80 ? "#22c087" : score >= 50 ? "#f7941d" : "#ef4b62";

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">SEO Score</h3>
      <div className="flex items-start gap-[18px]">
        <div className="relative h-[104px] w-[104px] flex-none">
          <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
            <circle cx="52" cy="52" r={r} fill="none" stroke="#e9eef5" strokeWidth="9" />
            <circle
              cx="52"
              cy="52"
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-extrabold leading-none text-text">{score}</div>
            <div className="mt-1 text-[0.68rem] font-semibold text-muted">/100</div>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-2.5 pt-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[0.74rem] font-semibold text-text">
              <span
                className="grid h-[17px] w-[17px] flex-none place-items-center rounded-full text-white"
                style={{ background: c.passed ? "#22c087" : "#f5a623" }}
              >
                {c.passed ? (
                  <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  "!"
                )}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
