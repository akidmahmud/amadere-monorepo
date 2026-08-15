"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useBlogTags, useDeleteBlogTag } from "@/hooks/useBlogTags";

export default function BlogTagsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: tags, isLoading } = useBlogTags(searchQuery);
  const deleteTag = useDeleteBlogTag();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">{tags?.length ?? 0} blog tags</p>
          <input
            type="text"
            placeholder="Search blog tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/blog-tags/new">
          <Button variant="primary">Add tag</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {tags && tags.length === 0 && (
        <p className="text-sm text-muted">
          {searchQuery ? `No blog tags matching "${searchQuery}".` : "No blog tags yet."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {tags?.map((tag) => (
          <Card key={tag.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{tag.translations[0]?.name ?? tag.slug}</div>
              <div className="text-xs text-muted">{tag.slug} · {tag.status}</div>
            </div>
            <Link href={`/blog-tags/${tag.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${tag.translations[0]?.name ?? tag.slug}"?`)) deleteTag.mutate(tag.id);
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
