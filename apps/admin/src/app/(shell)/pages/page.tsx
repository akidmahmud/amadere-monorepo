"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeletePage, usePages } from "@/hooks/usePages";

export default function PagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: pages, isLoading } = usePages(searchQuery);
  const deletePage = useDeletePage();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">{pages?.length ?? 0} pages</p>
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/pages/new">
          <Button variant="primary">Add page</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {pages && pages.length === 0 && (
        <p className="text-sm text-muted">
          {searchQuery ? `No static pages matching "${searchQuery}".` : "No static pages yet."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {pages?.map((page) => (
          <Card key={page.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {page.translations[0]?.title ?? page.slug}
              </div>
              <div className="text-xs text-muted">/{page.slug} · {page.status}</div>
            </div>
            <Link href={`/pages/${page.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${page.translations[0]?.title ?? page.slug}"?`)) deletePage.mutate(page.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
