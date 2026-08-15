"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import { usePickerCategories, usePickerTags } from "@/hooks/usePickers";
import { useBrands } from "@/hooks/useBrands";
import { useCreateTag } from "@/hooks/useTags";
import type { ProductFormState } from "./useProductFormState";

type Paginated<T> = { items?: T[]; total?: number };
type AdminTagDto = components["schemas"]["AdminTagDto"];

const selectClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-brand-500";

function toggle(list: number[], id: number, set: (ids: number[]) => void) {
  set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

// Same slugify as BlogPostFormFields.tsx — small enough to duplicate rather
// than pull into a shared util for one more caller.
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function ProductCategoriesTagsCard({ form }: { form: ProductFormState }) {
  const { data: categories } = usePickerCategories();
  const { data: tags } = usePickerTags();
  const { data: brands } = useBrands();
  const createTag = useCreateTag();
  const qc = useQueryClient();
  const [tagSearch, setTagSearch] = useState("");
  // usePickerTags fetches a flat pageSize-100 page (the backend hard-caps
  // pageSize at 100) ordered oldest-first, so once a catalog has more than
  // 100 tags — this one does — nothing past the 100th-oldest ever appears in
  // it, permanently, no matter how many times it's refetched. Tags resolved
  // here (found via a targeted backend search, or freshly created — both
  // always land past that cutoff) are kept in their own bit of state so they
  // still render as real chips/checkboxes instead of silently vanishing.
  const [extraTags, setExtraTags] = useState<{ id: number; label: string }[]>([]);

  const allTags = useMemo(() => {
    const map = new Map((tags ?? []).map((t) => [t.id, t] as const));
    for (const t of extraTags) if (!map.has(t.id)) map.set(t.id, t);
    return [...map.values()];
  }, [tags, extraTags]);

  const selectedTags = allTags.filter((t) => form.tagIds.includes(t.id));
  const filteredTags = allTags.filter((t) => t.label.toLowerCase().includes(tagSearch.trim().toLowerCase()));

  // A product's already-assigned tags can themselves be past the picker's
  // page-1-of-100 cutoff (same root cause as the comment above) — without
  // this, opening an existing product could silently show fewer selected
  // chips than it actually has tags, even though form.tagIds is correct.
  // One batched `ids=` request resolves every missing id at once — this used
  // to be one GET /admin/tags/:id per missing tag (18+ sequential round
  // trips on a heavily-tagged product), which was most of this page's load time.
  useEffect(() => {
    if (!tags) return;
    const known = new Set([...tags.map((t) => t.id), ...extraTags.map((t) => t.id)]);
    const missing = form.tagIds.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    proxyFetch<Paginated<AdminTagDto>>(`/admin/tags?ids=${missing.join(",")}`)
      .then((res) => {
        if (cancelled) return;
        const found = (res.items ?? []).map((t) => ({ id: t.id, label: t.translations?.[0]?.name ?? t.slug }));
        if (found.length > 0) setExtraTags((prev) => [...prev, ...found]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, form.tagIds]);

  // Lets "wallet, new tag, bags<Enter>" add all three in one go — each piece
  // is trimmed (so stray spaces around commas don't matter). Each name is
  // checked against the *server* (not just the locally-loaded picker page)
  // before deciding to create it, so a tag ranked past #100 doesn't get
  // silently duplicated just because it isn't in the capped local list.
  async function commitTagSearch() {
    const names = tagSearch.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    const ids: number[] = [];
    const resolved: { id: number; label: string }[] = [];
    for (const name of names) {
      const localMatch = allTags.find((t) => t.label.toLowerCase() === name.toLowerCase());
      if (localMatch) {
        ids.push(localMatch.id);
        continue;
      }
      const searchRes = await proxyFetch<Paginated<AdminTagDto>>(
        `/admin/tags?pageSize=5&q=${encodeURIComponent(name)}`,
      );
      const serverMatch = (searchRes.items ?? []).find(
        (t) => (t.translations?.[0]?.name ?? "").toLowerCase() === name.toLowerCase(),
      );
      if (serverMatch) {
        ids.push(serverMatch.id);
        resolved.push({ id: serverMatch.id, label: serverMatch.translations?.[0]?.name ?? name });
        continue;
      }
      const created = await createTag.mutateAsync({
        slug: slugify(name),
        status: "PUBLISHED",
        translations: [
          { locale: "EN", name },
          { locale: "BN", name },
        ],
      });
      ids.push(created.id);
      resolved.push({ id: created.id, label: name });
    }
    if (resolved.length > 0) setExtraTags((prev) => [...prev, ...resolved]);
    form.setTagIds([...new Set([...form.tagIds, ...ids])]);
    setTagSearch("");
    qc.invalidateQueries({ queryKey: ["picker-tags"] });
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Categories &amp; Tags</h3>

      <div className="mb-3.5">
        <span className="mb-2 block text-xs font-bold text-text">
          Category<span className="ml-0.5 text-danger">*</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {categories?.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
              <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggle(form.categoryIds, c.id, form.setCategoryIds)} className="accent-brand-500" />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <label className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text">Brand (optional)</span>
        <select value={form.brandId ?? ""} onChange={(e) => form.setBrandId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
          <option value="">None</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.translations[0]?.name ?? b.slug}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-2 block text-xs font-bold text-text">Tags</span>
        {selectedTags.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {selectedTags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">
                {t.label}
                <button
                  type="button"
                  onClick={() => toggle(form.tagIds, t.id, form.setTagIds)}
                  className="font-extrabold opacity-80 hover:opacity-100"
                  aria-label={`Remove ${t.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTagSearch();
            }
          }}
          disabled={createTag.isPending}
          placeholder="Search or add tags…"
          className="h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500 disabled:opacity-60"
        />
        {/* Persistent, unlike the old placeholder-only hint — a placeholder
            disappears the moment you start typing, which is exactly when
            someone mid-way through "wallet, bags" most needs the reminder
            that commas split it into separate tags. */}
        <p className="mb-2.5 mt-1 text-[0.68rem] text-muted">
          Tip: separate multiple tags with a comma, then press Enter to add them all at once.
        </p>
        <div className="flex max-h-[210px] flex-col gap-1 overflow-y-auto rounded-inner border border-border p-2">
          {filteredTags.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-2 text-[0.74rem] font-semibold text-text hover:bg-surface-2">
              <input type="checkbox" checked={form.tagIds.includes(t.id)} onChange={() => toggle(form.tagIds, t.id, form.setTagIds)} className="h-3.5 w-3.5 accent-brand-500" />
              {t.label}
            </label>
          ))}
          {filteredTags.length === 0 && (
            <p className="px-1.5 py-2 text-[0.72rem] text-muted">
              {tagSearch.trim() ? "No match — press Enter to create it." : "No tags match your search."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
