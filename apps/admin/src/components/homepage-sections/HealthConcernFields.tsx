"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type AdminTagDto = components["schemas"]["AdminTagDto"];
type Tag = { id: number; label: string; published: boolean };

const toTag = (t: AdminTagDto): Tag => ({
  id: t.id,
  label: t.translations?.[0]?.name ?? t.slug,
  published: (t.status as unknown as string) === "PUBLISHED",
});

/**
 * HEALTH_CONCERN config: which product tags show as pills, in order. Searched
 * rather than listed — there are well over a thousand tags, and the plain
 * first-100 picker used elsewhere would never reach most of them. Nothing
 * picked keeps the old behaviour: the first 6 published tags.
 */
export function HealthConcernFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const tagIds = ((config.tagIds as unknown[] | undefined) ?? []).filter((id): id is number => typeof id === "number");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const results = useQuery({
    queryKey: ["health-concern-tag-search", debounced],
    enabled: debounced.length > 0,
    queryFn: async () => {
      const res = await proxyFetch<{ items?: AdminTagDto[] }>(`/admin/tags?pageSize=20&q=${encodeURIComponent(debounced)}`);
      return (res.items ?? []).map(toTag);
    },
    placeholderData: keepPreviousData,
  });

  const picked = useQuery({
    queryKey: ["health-concern-tags", tagIds.join(",")],
    enabled: tagIds.length > 0,
    queryFn: async () => {
      const res = await proxyFetch<{ items?: AdminTagDto[] }>(`/admin/tags?ids=${tagIds.join(",")}`);
      return new Map((res.items ?? []).map((t) => [t.id, toTag(t)]));
    },
    placeholderData: keepPreviousData,
  });

  const setIds = (ids: number[]) => onConfigChange({ ...config, tagIds: ids });
  const move = (i: number, by: -1 | 1) => {
    const next = [...tagIds];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Tags shown as pills, in this order (none picked = the first 6 published tags)
        </span>
        {tagIds.length === 0 && <p className="text-sm text-muted">None picked — showing the first 6 published tags.</p>}
        <div className="flex flex-col gap-2">
          {tagIds.map((id, i) => {
            const tag = picked.data?.get(id);
            return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="w-6 text-xs font-bold text-muted">{i + 1}</span>
                <span className="flex-1 font-semibold text-text">{tag?.label ?? `Tag #${id}`}</span>
                {tag && !tag.published && <span className="text-[11px] font-semibold text-amber-600">Not published — hidden on site</span>}
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-7 place-items-center rounded border border-border text-secondary disabled:opacity-40">↑</button>
                <button type="button" aria-label="Move down" disabled={i === tagIds.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-7 place-items-center rounded border border-border text-secondary disabled:opacity-40">↓</button>
                <button type="button" aria-label="Remove" onClick={() => setIds(tagIds.filter((x) => x !== id))} className="grid h-7 w-7 place-items-center rounded border border-border text-rose-600">×</button>
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Add a tag</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags by name…"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      {debounced && (
        <div className="flex flex-wrap gap-2">
          {results.isLoading && <p className="text-sm text-muted">Searching…</p>}
          {results.data?.length === 0 && <p className="text-sm text-muted">No tag matches.</p>}
          {results.data
            ?.filter((t) => !tagIds.includes(t.id))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setIds([...tagIds, t.id]);
                  setSearch("");
                }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:border-brand-500"
              >
                + {t.label}
                {!t.published && <span className="ml-1 text-amber-600">(unpublished)</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
