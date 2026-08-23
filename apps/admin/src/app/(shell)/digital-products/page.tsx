"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, TableSkeleton } from "@amader/admin-ui";
import { useDigitalProducts } from "@/hooks/useDigitalProducts";
import { useDeleteProduct } from "@/hooks/useProducts";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-surface-2 text-secondary",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};

const PAGE_SIZE = 20;

export default function DigitalProductsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  // Product deletion is generic (a digital product is still a Product row)
  // — reuses useDeleteProduct from useProducts.ts rather than a duplicate
  // mutation in useDigitalProducts.ts.
  const deleteProduct = useDeleteProduct();
  const toast = useToast();
  const { data, isLoading } = useDigitalProducts(page, PAGE_SIZE, q || undefined);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteProduct.mutate(id, {
      onError: (err) => toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to delete product"),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">{total} digital product{total === 1 ? "" : "s"}</p>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search…"
            className="h-9 w-56 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/digital-products/new">
          <Button variant="primary">Add digital product</Button>
        </Link>
      </div>

      {isLoading && <TableSkeleton />}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted">No digital products yet — click &quot;Add digital product&quot; to upload your first PDF.</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((product) => (
          <Card key={product.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {product.thumbnailUrl && <img src={product.thumbnailUrl} alt="" className="h-10 w-10 rounded-inner border border-border object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{product.name}</div>
              <div className="text-xs text-muted">{product.sku ?? product.slug}</div>
            </div>
            <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${STATUS_PILL[product.status] ?? "bg-surface-2 text-secondary"}`}>
              {product.status}
            </span>
            <Link href={`/digital-products/${product.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button type="button" variant="ghost" onClick={() => handleDelete(product.id, product.name)}>
              Delete
            </Button>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="h-9 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-9 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
