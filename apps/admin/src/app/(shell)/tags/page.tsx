"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useDeleteTag, useTags, type AdminTag } from "@/hooks/useTags";

const headerStyle = { background: "linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)" };

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;

  // Subsequence character matching
  let qIdx = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) qIdx++;
  }
  return qIdx === q.length;
}

function matchesSearch(tag: AdminTag, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();

  const bnName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN")?.name || "";
  const enName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN")?.name || "";
  const fallbackName = tag.translations[0]?.name || "";
  const desc = tag.translations[0]?.description || "";

  const candidates = [bnName, enName, fallbackName, tag.slug, String(tag.id), desc];
  return candidates.some((cand) => fuzzyMatch(cand, q));
}

export default function TagsPage() {
  const { data: tags, isLoading } = useTags();
  const deleteTag = useDeleteTag();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const totalCount = tags?.length ?? 0;
  const publishedCount = tags?.filter((t) => t.status === "PUBLISHED").length ?? 0;
  const draftCount = tags?.filter((t) => t.status === "DRAFT").length ?? 0;

  const filteredTags = tags?.filter((tag) => {
    if (statusFilter !== "ALL" && tag.status !== statusFilter) return false;
    return matchesSearch(tag, searchQuery);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Header */}
      <PageHeader
        icon={<Icon name="local_offer" />}
        title="Product Tags & Labels"
        subtitle="Manage product tags, labels, and indexing terms for storefront filter navigation."
        style={headerStyle}
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3.5 border-l-4 border-l-brand-500">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand-50 text-brand-500">
            <Icon name="local_offer" size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted">Total Tags</span>
            <p className="text-xl font-extrabold text-text mt-0.5">{totalCount}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 border-l-4 border-l-emerald-500">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-emerald-50 text-emerald-600">
            <Icon name="check_circle" size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted">Published</span>
            <p className="text-xl font-extrabold text-text mt-0.5">{publishedCount}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 border-l-4 border-l-amber-500">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-amber-50 text-amber-600">
            <Icon name="edit_note" size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted">Draft / Review</span>
            <p className="text-xl font-extrabold text-text mt-0.5">{draftCount}</p>
          </div>
        </Card>
      </div>

      {/* Toolbar & Fuzzy Searchbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
        {/* Fuzzy Search Bar */}
        <div className="relative w-full sm:w-96">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Fuzzy search tags by name, slug, description…"
            className="h-10 w-full rounded-sm border border-border bg-surface pl-9 pr-8 text-sm text-text outline-none focus:border-brand-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills & Actions */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Status Tabs */}
          <div className="flex rounded-sm bg-surface-2 p-1 border border-border">
            {["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-xs px-2.5 py-1 text-xs font-bold transition-all ${
                  statusFilter === st ? "bg-surface text-brand-500 shadow-2xs" : "text-muted hover:text-text"
                }`}
              >
                {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex rounded-sm bg-surface-2 p-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-xs transition-colors ${viewMode === "list" ? "bg-surface text-brand-500 shadow-2xs" : "text-muted"}`}
              title="List view"
            >
              <Icon name="format_list_bulleted" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-xs transition-colors ${viewMode === "grid" ? "bg-surface text-brand-500 shadow-2xs" : "text-muted"}`}
              title="Grid view"
            >
              <Icon name="grid_view" size={16} />
            </button>
          </div>

          <Link href="/tags/new">
            <Button variant="primary" className="gap-2">
              <Icon name="add" size={16} />
              <span>Add Tag</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-3 text-sm text-muted">
            <Icon name="progress_activity" className="animate-spin" size={20} />
            <span>Loading product tags…</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredTags && filteredTags.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="local_offer" size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text">No Tags Found</h3>
            <p className="text-xs text-muted mt-1">
              {searchQuery ? `No tags matching "${searchQuery}".` : "Get started by adding your first product tag."}
            </p>
          </div>
          <Link href="/tags/new" className="mt-2">
            <Button variant="primary">Add First Tag</Button>
          </Link>
        </Card>
      )}

      {/* Tags Presentation */}
      {filteredTags && filteredTags.length > 0 && (
        viewMode === "list" ? (
          <div className="flex flex-col gap-3">
            {filteredTags.map((tag) => {
              const bnName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN")?.name;
              const enName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN")?.name;
              const name = bnName || enName || tag.translations[0]?.name || tag.slug;
              const description = tag.translations[0]?.description;

              return (
                <Card key={tag.id} className="flex items-center gap-4 hover:border-brand-500/40 hover:shadow-xs transition-all border-2 border-border">
                  {/* Tag Pill Badge Icon */}
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand-50 text-brand-500 font-bold text-sm">
                    🏷️
                  </div>

                  {/* Title & Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-text">{name}</h4>
                      {bnName && enName && bnName !== enName && (
                        <span className="text-xs text-muted truncate">({enName})</span>
                      )}
                      <span className="rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-medium text-muted border border-border">
                        /{tag.slug}
                      </span>
                    </div>
                    {description && <p className="truncate text-xs text-muted mt-0.5">{description}</p>}
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
                      tag.status === "PUBLISHED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : tag.status === "DRAFT"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        tag.status === "PUBLISHED" ? "bg-emerald-500" : tag.status === "DRAFT" ? "bg-amber-500" : "bg-slate-400"
                      }`}
                    />
                    {tag.status}
                  </span>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Link href={`/tags/${tag.id}`}>
                      <Button type="button" variant="ghost" className="h-9 px-3 text-xs font-bold">
                        <Icon name="edit" size={15} />
                        <span>Edit</span>
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-2 text-xs text-danger hover:bg-danger/5"
                      onClick={() => {
                        if (confirm(`Delete tag "${name}"?`)) deleteTag.mutate(tag.id);
                      }}
                    >
                      <Icon name="delete" size={15} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredTags.map((tag) => {
              const bnName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN")?.name;
              const enName = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN")?.name;
              const name = bnName || enName || tag.translations[0]?.name || tag.slug;
              const description = tag.translations[0]?.description;

              return (
                <Card key={tag.id} className="flex flex-col justify-between gap-4 p-5 hover:border-brand-500/40 hover:shadow-xs transition-all border-2 border-border">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-600 border border-brand-200">
                        🏷️ {name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          tag.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {tag.status}
                      </span>
                    </div>

                    <p className="font-mono text-xs font-semibold text-secondary mb-1">/{tag.slug}</p>
                    {description && <p className="text-xs text-muted line-clamp-2 mt-1">{description}</p>}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-auto">
                    <span className="text-[11px] font-mono text-muted">ID: #{tag.id}</span>
                    <div className="flex items-center gap-1">
                      <Link href={`/tags/${tag.id}`}>
                        <Button type="button" variant="ghost" className="h-8 px-2.5 text-xs font-bold">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-danger hover:bg-danger/5"
                        onClick={() => {
                          if (confirm(`Delete tag "${name}"?`)) deleteTag.mutate(tag.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
