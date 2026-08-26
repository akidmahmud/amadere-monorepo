"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeletePage, usePages } from "@/hooks/usePages";

export default function PagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const { data: pages, isLoading } = usePages(searchQuery);
  const deletePage = useDeletePage();

  const filteredPages = useMemo(() => {
    if (!pages) return [];
    return pages.filter((page) => {
      if (statusFilter === "PUBLISHED") return page.status === "PUBLISHED";
      if (statusFilter === "DRAFT") return page.status === "DRAFT";
      return true;
    });
  }, [pages, statusFilter]);

  const stats = useMemo(() => {
    if (!pages) return { total: 0, published: 0, draft: 0 };
    return {
      total: pages.length,
      published: pages.filter((p) => p.status === "PUBLISHED").length,
      draft: pages.filter((p) => p.status === "DRAFT").length,
    };
  }, [pages]);

  return (
    <div className="space-y-6">
      {/* Top Header & Page Stats Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text">Page Management</h1>
          <p className="text-xs text-secondary mt-0.5">
            Create, publish, and design storefront landing pages with the visual block builder.
          </p>
        </div>
        <Link href="/pages/new">
          <Button variant="primary" className="shadow-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1.5 h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add New Page
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-text">{stats.total}</div>
            <div className="text-xs font-medium text-secondary">Total Static Pages</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-text">{stats.published}</div>
            <div className="text-xs font-medium text-secondary">Published Pages</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-text">{stats.draft}</div>
            <div className="text-xs font-medium text-secondary">Draft Pages</div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-md bg-surface-hover p-1">
            {(["ALL", "PUBLISHED", "DRAFT"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === tab
                    ? "bg-surface text-brand-600 shadow-sm"
                    : "text-secondary hover:text-text"
                }`}
              >
                {tab === "ALL" ? "All Pages" : tab === "PUBLISHED" ? "Published" : "Drafts"}
              </button>
            ))}
          </div>

          <div className="relative">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary pointer-events-none"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[38px] w-full rounded-md border border-border bg-surface pl-9 pr-8 text-xs text-text outline-none focus:border-brand-500 sm:w-[260px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-text"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card className="p-8 text-center text-sm text-secondary">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mb-2" />
          <p>Loading pages list…</p>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && filteredPages.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-secondary mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-text">No pages found</h3>
          <p className="mt-1 text-xs text-secondary max-w-sm">
            {searchQuery
              ? `No pages match your search "${searchQuery}".`
              : statusFilter !== "ALL"
                ? `No pages with status "${statusFilter}".`
                : "Get started by creating your first custom static page."}
          </p>
          <Link href="/pages/new" className="mt-4">
            <Button variant="primary">Create Page</Button>
          </Link>
        </Card>
      )}

      {/* Page Items Cards */}
      {!isLoading && filteredPages.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filteredPages.map((page) => {
            const pageTitle = page.translations[0]?.title || page.slug;
            const isPublished = page.status === "PUBLISHED";

            return (
              <Card
                key={page.id}
                className="flex flex-col gap-4 p-4 transition-all hover:border-brand-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-text">
                      {pageTitle}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                        isPublished
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                      }`}
                    >
                      {page.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-secondary">
                    <span className="font-mono text-secondary hover:text-brand-600">
                      /{page.slug}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                  <Link href={`/pages/${page.id}/builder`}>
                    <Button variant="primary" className="flex items-center gap-1.5 shadow-sm">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h4a.75.75 0 010 1.5h-4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.25 2.5a.75.75 0 000 1.5h2.44l-6.47 6.47a.75.75 0 101.06 1.06L16.75 5.06v2.44a.75.75 0 001.5 0v-4a.75.75 0 00-.75-.75h-4z" />
                      </svg>
                      Open Builder
                    </Button>
                  </Link>

                  <Link href={`/pages/${page.id}`}>
                    <Button type="button" variant="ghost">
                      Edit Meta
                    </Button>
                  </Link>

                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${pageTitle}"?`)) {
                        deletePage.mutate(page.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
