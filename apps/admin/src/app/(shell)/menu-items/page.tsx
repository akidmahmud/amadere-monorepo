"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteMenuItem, useMenuItems } from "@/hooks/useMenuItems";

export default function MenuItemsPage() {
  const { data: items, isLoading } = useMenuItems();
  const deleteItem = useDeleteMenuItem();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{items?.length ?? 0} menu items</p>
        <Link href="/menu-items/new">
          <Button variant="primary">Add menu item</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted">No menu items yet.</p>}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{item.translations[0]?.label}</div>
              <div className="text-xs text-muted">
                {item.href} · {item.isActive ? "active" : "inactive"}
                {item.parentId && ` · under #${item.parentId}`}
              </div>
            </div>
            <Link href={`/menu-items/${item.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${item.translations[0]?.label}"?`)) deleteItem.mutate(item.id);
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
