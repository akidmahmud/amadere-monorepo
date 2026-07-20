"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteSeoMeta, useSeoMeta, useUpsertSeoMeta, type SeoEntityType } from "@/hooks/useSeoMeta";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const EMPTY_FORM = { title: "", description: "", canonicalUrl: "", robots: "index,follow", ogTitle: "", ogDescription: "", ogImageUrl: "" };

// Same fields as the standalone /seo-meta lookup page, but scoped to a known
// entity (dropped straight into the product/category/blog-post edit pages)
// so nobody has to go find the entity's numeric ID and type it in by hand.
export function SeoMetaCard({ entityType, entityId }: { entityType: SeoEntityType; entityId: number }) {
  const [locale, setLocale] = useState<"EN" | "BN">("EN");
  const [form, setForm] = useState(EMPTY_FORM);
  // Tracked locally rather than read straight off query.data: react-query
  // keeps the last successful value around across a background refetch
  // error (e.g. the 404 right after a delete), so query.data alone would
  // leave the "existing record" label and Reset button stuck on stale state.
  const [exists, setExists] = useState(false);
  const query = useSeoMeta(entityType, entityId, locale, entityId > 0);
  const upsert = useUpsertSeoMeta();
  const remove = useDeleteSeoMeta();

  useEffect(() => {
    if (query.isLoading) return;
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
  }, [query.data, query.isLoading, locale]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">SEO</h3>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as "EN" | "BN")}
          className="h-9 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none"
        >
          <option value="EN">EN</option>
          <option value="BN">BN</option>
        </select>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            {exists ? "Editing existing SEO record." : "No override yet — the public page falls back to its own title/description until you save one here."}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta title</span>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta description</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
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

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save SEO"}
            </Button>
            {exists && (
              <Button
                type="button"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { entityType, entityId, locale },
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
        </form>
      )}
    </Card>
  );
}
