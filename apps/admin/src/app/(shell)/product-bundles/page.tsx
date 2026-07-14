"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteProductBundle, useProductBundles } from "@/hooks/useProductBundles";

export default function ProductBundlesPage() {
  const { data: bundles, isLoading } = useProductBundles();
  const deleteBundle = useDeleteProductBundle();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{bundles?.length ?? 0} bundles</p>
        <Link href="/product-bundles/new">
          <Button variant="primary">Add bundle</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {bundles && bundles.length === 0 && <p className="text-sm text-muted">No bundles yet.</p>}

      <div className="flex flex-col gap-3">
        {bundles?.map((bundle) => (
          <Card key={bundle.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {bundle.translations[0]?.name ?? bundle.slug}
              </div>
              <div className="text-xs text-muted">
                {bundle.slug} · {bundle.status} · {bundle.items.length} items
                {bundle.bundlePrice && ` · ৳${bundle.bundlePrice}`}
                {bundle.discountPct && ` · ${bundle.discountPct}% off`}
              </div>
            </div>
            <Link href={`/product-bundles/${bundle.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${bundle.translations[0]?.name ?? bundle.slug}"?`)) deleteBundle.mutate(bundle.id);
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
