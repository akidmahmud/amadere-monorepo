"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/admin-ui";
import { useSeoMeta, useUpsertSeoMeta } from "@/hooks/useSeoMeta";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { SeoScoreRing } from "@/components/SeoScoreRing";
import { MediaPicker } from "@/components/MediaPicker";
import { OgPreviewCard } from "@/components/OgPreviewCard";
import { SeoCharCount } from "@/components/SeoCharCount";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

// `description` here can be the product's own CKEditor-authored rich-text
// field (see the `description` prop below) — shown raw, that puts literal
// `<p>`/`<strong>` tags in the preview instead of the plain text a real
// search-result snippet or share-link card would show. Same regex-strip
// approach as this codebase's other stripHtml copies (e.g.
// useProductFormState.ts) and the backend's SeoService (which applies the
// same fix to the real og:description meta tag).
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ProductSeoTab({
  productId,
  slug,
  name,
  description,
  primaryImageAlt,
  primaryImageUrl,
}: {
  productId?: number;
  slug: string;
  name: string;
  description: string;
  primaryImageAlt: string;
  /** The product's own first gallery image — same "no ogImageUrl override →
   * primary product image" fallback the public API already applies
   * server-side (products.service.ts's `imageUrl: imageUrls[0] ?? null`
   * passed into SeoService.resolve()), shown here so the admin sees exactly
   * what a shared product link will use even before setting an override. */
  primaryImageUrl?: string;
}) {
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  // Ephemeral, not derived from upsert.isSuccess — react-query doesn't reset
  // that flag on its own, so it would stay true forever after the first save
  // instead of confirming *this* save just happened.
  const [justSaved, setJustSaved] = useState(false);
  const query = useSeoMeta("PRODUCT", productId ?? 0, "EN", !!productId);
  const upsert = useUpsertSeoMeta();
  const storefrontUrl = useStorefrontUrl();
  const domain = (() => {
    try {
      return new URL(storefrontUrl).hostname;
    } catch {
      return storefrontUrl;
    }
  })();

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title ?? "");
      setMetaDescription(query.data.description ?? "");
      setOgImageUrl(query.data.ogImageUrl ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  if (!productId) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-800/20 bg-gradient-to-r from-emerald-50 via-white to-amber-50/40 p-5 text-sm font-semibold text-emerald-900 shadow-sm">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-700 ring-1 ring-amber-400/40">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <span>Save the product first — SEO metadata is edited once it has a real ID.</span>
      </div>
    );
  }

  const effectiveTitle = title || name;
  const effectiveDescription = stripHtml(metaDescription || description);
  const effectiveImageUrl = ogImageUrl || primaryImageUrl;

  async function handleSave() {
    await upsert.mutateAsync({
      entityType: "PRODUCT",
      entityId: productId!,
      locale: "EN",
      title: title || undefined,
      description: metaDescription || undefined,
      ogImageUrl: ogImageUrl || undefined,
      robots: "index,follow",
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              SEO Preview
            </h3>
            <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-400/30">
              Google Search Snippet
            </span>
          </div>
          <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/30 p-4 shadow-xs">
            <div className="text-[0.92rem] font-extrabold leading-snug text-emerald-800 hover:underline cursor-pointer">
              {effectiveTitle || "Untitled product"}
            </div>
            <div className="mt-1 break-all text-[0.72rem] font-bold text-emerald-950/70 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {storefrontUrl}/products/{slug || "product-slug"}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-emerald-950/80">
              {effectiveDescription || "No description set yet — the storefront will fall back to the product's own description."}
            </div>
          </div>

          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Meta title (optional, falls back to product name)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
              placeholder={name}
            />
            <SeoCharCount value={title} limit="title" />
          </label>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Meta description (optional)</span>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-emerald-800/20 bg-white p-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
            />
            <SeoCharCount value={metaDescription} limit="description" />
          </label>
          <div className="mt-4 flex flex-col gap-1.5">
            <MediaPicker label="Social/share preview image (optional)" value={ogImageUrl || undefined} onChange={setOgImageUrl} />
            <p className="text-xs text-emerald-950/60">
              {ogImageUrl
                ? "Overriding the product's own image for shared links (WhatsApp, Facebook, etc.)."
                : primaryImageUrl
                  ? "No override set — shared links will use the product's primary image below."
                  : "No override set, and this product has no image yet — shared links won't show a preview image."}
            </p>
            {!ogImageUrl && primaryImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primaryImageUrl} alt="" className="h-24 w-24 rounded-inner border border-dashed border-border object-cover opacity-80" />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Link preview (approximate)</span>
            <OgPreviewCard imageUrl={effectiveImageUrl} title={effectiveTitle} description={effectiveDescription} domain={domain} />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={upsert.isPending}
              onClick={handleSave}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-900 px-5 text-xs font-extrabold text-amber-300 shadow-md shadow-emerald-900/15 ring-1 ring-amber-400/40 transition-all duration-150 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50"
            >
              {upsert.isPending ? "Saving…" : "Save SEO"}
            </button>
            {justSaved && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                SEO Metadata Saved!
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
