"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeletePage, usePages } from "@/hooks/usePages";

export default function PagesPage() {
  const { data: pages, isLoading } = usePages();
  const deletePage = useDeletePage();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{pages?.length ?? 0} pages</p>
        <Link href="/pages/new">
          <Button variant="primary">Add page</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {pages && pages.length === 0 && <p className="text-sm text-muted">No static pages yet.</p>}

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
