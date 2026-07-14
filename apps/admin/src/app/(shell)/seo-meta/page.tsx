"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { SEO_ENTITY_TYPES, useDeleteSeoMeta, useSeoMeta, useUpsertSeoMeta, type SeoEntityType } from "@/hooks/useSeoMeta";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const EMPTY_FORM = { title: "", description: "", canonicalUrl: "", robots: "index,follow", ogTitle: "", ogDescription: "", ogImageUrl: "" };

// Entity-scoped, not a table — the backend has no "list all SEO records"
// endpoint, and a genuinely-missing record 404s (adminGet throws
// NotFoundException, not an empty-defaults response) — treated here as "no
// record yet, saving will create one" rather than an error state.
export default function SeoMetaPage() {
  const [entityType, setEntityType] = useState<SeoEntityType>("PRODUCT");
  const [entityId, setEntityId] = useState("");
  const [locale, setLocale] = useState<"EN" | "BN">("EN");
  const [looked, setLooked] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const numericId = Number(entityId);
  const query = useSeoMeta(entityType, numericId, locale, looked && Number.isFinite(numericId) && numericId > 0);
  const upsert = useUpsertSeoMeta();
  const remove = useDeleteSeoMeta();

  useEffect(() => {
    if (!looked || query.isLoading) return;
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
    } else {
      // 404 (no record yet) or any other fetch error — either way, start blank.
      setForm(EMPTY_FORM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isLoading, looked]);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLooked(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      entityType,
      entityId: numericId,
      locale,
      title: form.title || undefined,
      description: form.description || undefined,
      canonicalUrl: form.canonicalUrl || undefined,
      robots: form.robots,
      ogTitle: form.ogTitle || undefined,
      ogDescription: form.ogDescription || undefined,
      ogImageUrl: form.ogImageUrl || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={handleLookup} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Entity type</span>
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value as SeoEntityType); setLooked(false); }}
              className={inputClass}
            >
              {SEO_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Entity ID</span>
            <input
              type="number"
              required
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setLooked(false); }}
              className={`num ${inputClass} w-28`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Locale</span>
            <select
              value={locale}
              onChange={(e) => { setLocale(e.target.value as "EN" | "BN"); setLooked(false); }}
              className={inputClass}
            >
              <option value="EN">EN</option>
              <option value="BN">BN</option>
            </select>
          </label>
          <Button type="submit" variant="ghost">Look up</Button>
        </form>
      </Card>

      {looked && (
        <Card className="max-w-xl">
          {query.isLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <p className="text-xs text-muted">
                {query.data ? "Editing existing SEO record." : "No record yet — saving will create one."}
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Title</span>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Description</span>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Canonical URL</span>
                <input value={form.canonicalUrl} onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Robots</span>
                <input value={form.robots} onChange={(e) => setForm((f) => ({ ...f, robots: e.target.value }))} className={inputClass} />
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
                  {upsert.isPending ? "Saving…" : "Save"}
                </Button>
                {query.data && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ entityType, entityId: numericId, locale })}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
