"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/admin-ui";
import { useSeoMeta, useUpsertSeoMeta } from "@/hooks/useSeoMeta";
import { computeSeoChecks, computeSeoScore } from "./seo-score";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export function ProductSeoTab({
  productId,
  slug,
  name,
  description,
  primaryImageAlt,
}: {
  productId?: number;
  slug: string;
  name: string;
  description: string;
  primaryImageAlt: string;
}) {
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const query = useSeoMeta("PRODUCT", productId ?? 0, "EN", !!productId);
  const upsert = useUpsertSeoMeta();

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title ?? "");
      setMetaDescription(query.data.description ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  if (!productId) {
    return (
      <div className="rounded-card border border-border bg-surface p-[18px] text-sm text-muted">
        Save the product first — SEO metadata is edited once it has a real ID.
      </div>
    );
  }

  const effectiveTitle = title || name;
  const effectiveDescription = metaDescription || description;
  const checks = computeSeoChecks({
    metaTitle: effectiveTitle,
    metaDescription: effectiveDescription,
    slug,
    primaryImageAlt,
    description,
  });
  const score = computeSeoScore(checks);
  const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001";
  const r = 45;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const ringColor = score >= 80 ? "#22c087" : score >= 50 ? "#f7941d" : "#ef4b62";

  async function handleSave() {
    await upsert.mutateAsync({
      entityType: "PRODUCT",
      entityId: productId!,
      locale: "EN",
      title: title || undefined,
      description: metaDescription || undefined,
      robots: "index,follow",
    });
  }

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-[0.9rem] font-extrabold text-text">SEO Preview</h3>
          </div>
          <div className="rounded-[10px] border border-border p-[14px_15px]">
            <div className="text-[0.92rem] font-bold leading-snug text-[#1a5fd0]">{effectiveTitle || "Untitled product"}</div>
            <div className="mt-1.5 break-all text-[0.7rem] font-semibold text-[#1a8a4a]">
              {storefrontUrl}/products/{slug || "product-slug"}
            </div>
            <div className="mt-1.5 text-[0.73rem] leading-relaxed text-muted">
              {effectiveDescription || "No description set yet — the storefront will fall back to the product's own description."}
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta title (optional, falls back to product name)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={name} />
          </label>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta description (optional)</span>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={3}
              className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="button" variant="primary" className="mt-3.5" disabled={upsert.isPending} onClick={handleSave}>
            {upsert.isPending ? "Saving…" : "Save SEO"}
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-[18px]">
        <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">SEO Score</h3>
        <div className="flex items-start gap-[18px]">
          <div className="relative h-[104px] w-[104px] flex-none">
            <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
              <circle cx="52" cy="52" r={r} fill="none" stroke="#e9eef5" strokeWidth="9" />
              <circle cx="52" cy="52" r={r} fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
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
    </div>
  );
}
