"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteProduct, useProducts } from "@/hooks/useProducts";

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{products?.length ?? 0} products</p>
        <Link href="/products/new">
          <Button variant="primary">Add product</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {products && products.length === 0 && <p className="text-sm text-muted">No products yet.</p>}

      <div className="flex flex-col gap-3">
        {products?.map((product) => (
          <Card key={product.id} className="flex items-center gap-3">
            {product.media[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.media[0].url}
                alt=""
                className="h-10 w-10 rounded-inner border border-border object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {product.translations[0]?.name ?? product.slug}
              </div>
              <div className="text-xs text-muted">
                {product.slug} · {product.status} ·{" "}
                {product.hasVariants ? `${product.variants.length} variants` : `৳${product.price ?? "—"}`} · stock{" "}
                {product.stock}
              </div>
            </div>
            <Link href={`/products/${product.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${product.translations[0]?.name ?? product.slug}"?`))
                  deleteProduct.mutate(product.id);
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
