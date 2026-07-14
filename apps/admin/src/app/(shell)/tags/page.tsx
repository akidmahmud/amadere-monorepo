"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteTag, useTags } from "@/hooks/useTags";

export default function TagsPage() {
  const { data: tags, isLoading } = useTags();
  const deleteTag = useDeleteTag();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{tags?.length ?? 0} tags</p>
        <Link href="/tags/new">
          <Button variant="primary">Add tag</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {tags && tags.length === 0 && <p className="text-sm text-muted">No tags yet.</p>}

      <div className="flex flex-col gap-3">
        {tags?.map((tag) => (
          <Card key={tag.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{tag.translations[0]?.name ?? tag.slug}</div>
              <div className="text-xs text-muted">
                {tag.slug} · {tag.status}
              </div>
            </div>
            <Link href={`/tags/${tag.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
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
