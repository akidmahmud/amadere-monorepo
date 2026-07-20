"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAnnouncements, useDeleteAnnouncement } from "@/hooks/useAnnouncements";

export default function AnnouncementsPage() {
  const { data: items, isLoading } = useAnnouncements();
  const deleteItem = useDeleteAnnouncement();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{items?.length ?? 0} announcements</p>
        <Link href="/announcements/new">
          <Button variant="primary">Add announcement</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted">No announcements yet.</p>}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{item.translations[0]?.message}</div>
              <div className="text-xs text-muted">
                {item.isActive ? "active" : "inactive"}
                {item.linkUrl && ` · ${item.linkUrl}`}
              </div>
            </div>
            <Link href={`/announcements/${item.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${item.translations[0]?.message}"?`)) deleteItem.mutate(item.id);
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
