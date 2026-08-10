"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/admin-ui";
import { useSeoMeta, useUpsertSeoMeta } from "@/hooks/useSeoMeta";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { SeoScoreRing } from "@/components/SeoScoreRing";

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
  // Ephemeral, not derived from upsert.isSuccess — react-query doesn't reset
  // that flag on its own, so it would stay true forever after the first save
  // instead of confirming *this* save just happened.
  const [justSaved, setJustSaved] = useState(false);
  const query = useSeoMeta("PRODUCT", productId ?? 0, "EN", !!productId);
  const upsert = useUpsertSeoMeta();
  const storefrontUrl = useStorefrontUrl();

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

  async function handleSave() {
    await upsert.mutateAsync({
      entityType: "PRODUCT",
      entityId: productId!,
      locale: "EN",
      title: title || undefined,
      description: metaDescription || undefined,
      robots: "index,follow",
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
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
          <div className="mt-3.5 flex items-center gap-3">
            <Button type="button" variant="primary" disabled={upsert.isPending} onClick={handleSave}>
              {upsert.isPending ? "Saving…" : "Save SEO"}
            </Button>
            {justSaved && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      <SeoScoreRing
        metaTitle={effectiveTitle}
        metaDescription={effectiveDescription}
        slug={slug}
        primaryImageAlt={primaryImageAlt}
        description={description}
      />
    </div>
  );
}
