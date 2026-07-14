"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useCollections, useDeleteCollection } from "@/hooks/useCollections";

export default function CollectionsPage() {
  const { data: collections, isLoading } = useCollections();
  const deleteCollection = useDeleteCollection();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{collections?.length ?? 0} collections</p>
        <Link href="/collections/new">
          <Button variant="primary">Add collection</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {collections && collections.length === 0 && <p className="text-sm text-muted">No collections yet.</p>}

      <div className="flex flex-col gap-3">
        {collections?.map((collection) => (
          <Card key={collection.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {collection.translations[0]?.name ?? collection.slug}
              </div>
              <div className="text-xs text-muted">
                {collection.slug} · {collection.status} · {collection.products.length} products
              </div>
            </div>
            <Link href={`/collections/${collection.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${collection.translations[0]?.name ?? collection.slug}"?`))
                  deleteCollection.mutate(collection.id);
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
