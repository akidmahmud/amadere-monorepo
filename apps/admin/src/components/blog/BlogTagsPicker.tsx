"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { useBlogTags, useCreateBlogTag, type AdminBlogTag } from "@/hooks/useBlogTags";

type Paginated<T> = { items?: T[]; total?: number };

// Same bilingual-name handling as products' slugify (ProductFormFields.tsx)
// — blog post titles/tag names are often "English (বাংলা)" or "English |
// বাংলা", and the slug should come from the English part only.
function slugify(str: string): string {
  const ascii = str
    .replace(/\([^)]*\)/g, " ")
    .split("|")[0]
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (ascii) return ascii;
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function labelOf(t: { translations: { name: string }[]; slug: string }): string {
  return t.translations[0]?.name ?? t.slug;
}

export function BlogTagsPicker({ tagIds, onChange }: { tagIds: number[]; onChange: (ids: number[]) => void }) {
  const { data: tags } = useBlogTags();
  const createTag = useCreateBlogTag();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  // useBlogTags fetches a flat pageSize-100 page (the backend hard-caps
  // pageSize at 100) ordered oldest-first — same cutoff issue as products'
  // tag picker. Tags resolved here (via a targeted backend search, or
  // freshly created — both always land past that cutoff) are kept in their
  // own bit of state so they still render as real chips/checkboxes.
  const [extraTags, setExtraTags] = useState<{ id: number; label: string }[]>([]);

  const allTags = useMemo(() => {
    const map = new Map((tags ?? []).map((t) => [t.id, { id: t.id, label: labelOf(t) }] as const));
    for (const t of extraTags) if (!map.has(t.id)) map.set(t.id, t);
    return [...map.values()];
  }, [tags, extraTags]);

  const selectedTags = allTags.filter((t) => tagIds.includes(t.id));
  const filtered = allTags.filter((t) => t.label.toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(id: number) {
    onChange(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]);
  }

  // A post's already-assigned tags can themselves be past the picker's
  // page-1-of-100 cutoff — without this, opening an existing post could
  // silently show fewer selected chips than it actually has tags.
  useEffect(() => {
    if (!tags) return;
    const known = new Set([...tags.map((t) => t.id), ...extraTags.map((t) => t.id)]);
    const missing = tagIds.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) => proxyFetch<AdminBlogTag>(`/admin/blog-tags/${id}`).catch(() => null)),
    ).then((results) => {
      if (cancelled) return;
      const found = results.filter((t): t is AdminBlogTag => t !== null).map((t) => ({ id: t.id, label: labelOf(t) }));
      if (found.length > 0) setExtraTags((prev) => [...prev, ...found]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tagIds]);

  // Lets "wallet, new tag, bags<Enter>" add all three in one go — each name
  // is checked against the *server* (not just the locally-loaded picker
  // page) before deciding to create it, so a tag ranked past #100 doesn't
  // get silently duplicated.
  async function commitSearch() {
    const names = search.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    const ids: number[] = [];
    const resolved: { id: number; label: string }[] = [];
    for (const name of names) {
      const localMatch = allTags.find((t) => t.label.toLowerCase() === name.toLowerCase());
      if (localMatch) {
        ids.push(localMatch.id);
        continue;
      }
      const searchRes = await proxyFetch<Paginated<AdminBlogTag>>(
        `/admin/blog-tags?pageSize=5&q=${encodeURIComponent(name)}`,
      );
      const serverMatch = (searchRes.items ?? []).find((t) => labelOf(t).toLowerCase() === name.toLowerCase());
      if (serverMatch) {
        ids.push(serverMatch.id);
        resolved.push({ id: serverMatch.id, label: labelOf(serverMatch) });
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
    onChange([...new Set([...tagIds, ...ids])]);
    setSearch("");
    qc.invalidateQueries({ queryKey: ["admin-blog-tags"] });
  }

  return (
    <div>
      {selectedTags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {selectedTags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">
              {t.label}
              <button type="button" onClick={() => toggle(t.id)} className="font-extrabold opacity-80 hover:opacity-100" aria-label={`Remove ${t.label}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitSearch();
          }
        }}
        disabled={createTag.isPending}
        placeholder="Search or add tags — separate multiple with commas, press Enter"
        className="mb-2.5 h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500 disabled:opacity-60"
      />
      <div className="flex max-h-[210px] flex-col gap-1 overflow-y-auto pr-1.5">
        {filtered.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-2 text-[0.74rem] font-semibold text-text hover:bg-surface-2">
            <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(t.id)} className="h-3.5 w-3.5 accent-brand-500" />
            {t.label}
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-1.5 py-2 text-[0.72rem] text-muted">
            {search.trim() ? "No match — press Enter to create it." : "No tags match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
