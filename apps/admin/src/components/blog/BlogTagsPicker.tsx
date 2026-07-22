"use client";

import { useState } from "react";
import { useBlogTags } from "@/hooks/useBlogTags";

export function BlogTagsPicker({ tagIds, onChange }: { tagIds: number[]; onChange: (ids: number[]) => void }) {
  const { data: tags } = useBlogTags();
  const [search, setSearch] = useState("");

  const selectedTags = (tags ?? []).filter((t) => tagIds.includes(t.id));
  const filtered = (tags ?? []).filter((t) => (t.translations[0]?.name ?? t.slug).toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(id: number) {
    onChange(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]);
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {selectedTags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">
            {t.translations[0]?.name ?? t.slug}
            <button type="button" onClick={() => toggle(t.id)} className="font-extrabold opacity-80 hover:opacity-100" aria-label={`Remove ${t.translations[0]?.name}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tags..."
        className="mb-2.5 h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500"
      />
      <div className="flex max-h-[210px] flex-col gap-0.5 overflow-y-auto pr-1.5">
        {filtered.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-[0.74rem] font-semibold text-text hover:bg-surface-2">
            <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(t.id)} className="h-3.5 w-3.5 accent-brand-500" />
            {t.translations[0]?.name ?? t.slug}
          </label>
        ))}
        {filtered.length === 0 && <p className="px-1.5 py-2 text-[0.72rem] text-muted">No tags match your search.</p>}
      </div>
    </div>
  );
}
