"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteSeoMeta, useSeoMeta, useUpsertSeoMeta, type SeoEntityType } from "@/hooks/useSeoMeta";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { SeoScoreRing } from "@/components/SeoScoreRing";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const EMPTY_FORM = { title: "", description: "", canonicalUrl: "", robots: "index,follow", ogTitle: "", ogDescription: "", ogImageUrl: "" };

export interface SeoMetaCardValue {
  title: string;
  description: string;
}

// Same fields as the standalone /seo-meta lookup page, but scoped to a known
// entity (dropped straight into the product/category/collection/blog-post
// edit pages) so nobody has to go find the entity's numeric ID and type it
// in by hand.
//
// `entityId` is optional so this same component also works on a "New X"
// page BEFORE the entity has a real ID yet — the entity's create endpoint
// has to run first (SEO meta is a separate row keyed by entityId, there's
// nothing to key it to until then). In that "buffered" mode there's no
// useSeoMeta/upsert call — the title/description live in the parent's own
// form state (`value`/`onChange`), and the parent is responsible for firing
// one upsertSeoMeta call right after its own create call resolves with a
// real ID. The SEO Score card and Google-preview box both work identically
// in either mode since they only need the current title/description text,
// not a saved record.
//
// `slug`/`previewPath`/`fallback*` are optional — the live Google-SERP-style
// preview box (same pattern as ProductSeoTab's dedicated one) only renders
// when a slug is passed, so the generic /seo-meta lookup page (which has no
// single known entity to preview) is unaffected.
export function SeoMetaCard({
  entityType,
  entityId,
  slug,
  previewPath,
  fallbackTitle,
  fallbackDescription,
  value,
  onChange,
}: {
  entityType: SeoEntityType;
  entityId?: number;
  slug?: string;
  previewPath?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  /** Buffered mode only (entityId undefined) — the parent owns the draft value. */
  value?: SeoMetaCardValue;
  onChange?: (value: SeoMetaCardValue) => void;
}) {
  const buffered = entityId === undefined;
  const [locale, setLocale] = useState<"EN" | "BN">("EN");
  const [form, setForm] = useState(EMPTY_FORM);
  // Tracked locally rather than read straight off query.data: react-query
  // keeps the last successful value around across a background refetch
  // error (e.g. the 404 right after a delete), so query.data alone would
  // leave the "existing record" label and Reset button stuck on stale state.
  const [exists, setExists] = useState(false);
  // Ephemeral, not derived from mutation state — upsert.isSuccess would stay
  // true forever after the first save (react-query doesn't reset it on its
  // own), which would leave the indicator on permanently instead of
  // confirming *this* save just happened.
  const [justSaved, setJustSaved] = useState(false);
  const query = useSeoMeta(entityType, entityId ?? 0, locale, !buffered);
  const upsert = useUpsertSeoMeta();
  const remove = useDeleteSeoMeta();

  useEffect(() => {
    if (buffered || query.isLoading) return;
    if (query.data) {
      setForm({
        title: query.data.title ?? "",
        description: query.data.description ?? "",
        canonicalUrl: query.data.canonicalUrl ?? "",
        robots: query.data.robots,
        ogTitle: query.data.ogTitle ?? "",
        ogDescription: query.data.ogDescription ?? "",
        ogImageUrl: query.data.ogImageUrl ?? "",
      });
      setExists(true);
    } else {
      setForm(EMPTY_FORM);
      setExists(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffered, query.data, query.isLoading, locale]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (buffered || entityId === undefined) return;
    await upsert.mutateAsync({
      entityType,
      entityId,
      locale,
      title: form.title || undefined,
      description: form.description || undefined,
      canonicalUrl: form.canonicalUrl || undefined,
      robots: form.robots,
      ogTitle: form.ogTitle || undefined,
      ogDescription: form.ogDescription || undefined,
      ogImageUrl: form.ogImageUrl || undefined,
    });
    setExists(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  }

  // Buffered mode only edits title/description (the fields that matter for
  // the preview/score) — canonical URL/robots/OG fields aren't worth
  // collecting before the entity even exists; they stay editable on the
  // real record after creation via this same card.
  const title = buffered ? (value?.title ?? "") : form.title;
  const description = buffered ? (value?.description ?? "") : form.description;
  function setTitle(v: string) {
    if (buffered) onChange?.({ title: v, description });
    else setForm((f) => ({ ...f, title: v }));
  }
  function setDescription(v: string) {
    if (buffered) onChange?.({ title, description: v });
    else setForm((f) => ({ ...f, description: v }));
  }

  const effectiveTitle = title || fallbackTitle || "";
  const effectiveDescription = description || fallbackDescription || "";
  const storefrontUrl = useStorefrontUrl();

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      {slug && previewPath && (
        <div>
          <h3 className="mb-3 font-ui text-sm font-bold text-text">SEO Preview</h3>
          <div className="rounded-[10px] border border-border p-[14px_15px]">
            <div className="text-[0.92rem] font-bold leading-snug text-[#1a5fd0]">{effectiveTitle || "Untitled"}</div>
            <div className="mt-1.5 break-all text-[0.7rem] font-semibold text-[#1a8a4a]">
              {storefrontUrl}
              {previewPath}/{slug}
            </div>
            <div className="mt-1.5 text-[0.73rem] leading-relaxed text-muted">
              {effectiveDescription || "No description set yet — the storefront will fall back to the page's own content."}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">SEO</h3>
        {!buffered && (
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "EN" | "BN")}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none"
          >
            <option value="EN">EN</option>
            <option value="BN">BN</option>
          </select>
        )}
      </div>

      {!buffered && query.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            {buffered
              ? "Saved automatically once you create this — no separate step needed."
              : exists
                ? "Editing existing SEO record."
                : "No override yet — the public page falls back to its own title/description until you save one here."}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={fallbackTitle} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" placeholder={fallbackDescription} />
          </label>

          {!buffered && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Canonical URL</span>
                <input value={form.canonicalUrl} onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))} className={inputClass} placeholder="Leave blank to use the default page URL" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Robots</span>
                <input value={form.robots} onChange={(e) => setForm((f) => ({ ...f, robots: e.target.value }))} className={inputClass} placeholder="index,follow" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">OG title</span>
                <input value={form.ogTitle} onChange={(e) => setForm((f) => ({ ...f, ogTitle: e.target.value }))} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">OG description</span>
                <input value={form.ogDescription} onChange={(e) => setForm((f) => ({ ...f, ogDescription: e.target.value }))} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">OG image URL</span>
                <input value={form.ogImageUrl} onChange={(e) => setForm((f) => ({ ...f, ogImageUrl: e.target.value }))} className={inputClass} />
              </label>

              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={upsert.isPending}>
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
                {exists && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { entityType, entityId: entityId!, locale },
                        {
                          onSuccess: () => {
                            setForm(EMPTY_FORM);
                            setExists(false);
                          },
                        },
                      )
                    }
                  >
                    Reset to defaults
                  </Button>
                )}
              </div>
            </>
          )}
        </form>
      )}

      <SeoScoreRing
        metaTitle={effectiveTitle}
        metaDescription={effectiveDescription}
        slug={slug ?? ""}
        primaryImageAlt={fallbackTitle ?? ""}
        description={fallbackDescription ?? ""}
      />
    </Card>
  );
}
