"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { useProductFormState } from "@/components/products/useProductFormState";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productId = Number(id);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const form = useProductFormState();
  const update = useUpdateProduct(productId);

  useEffect(() => {
    if (product) form.seedFrom(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form.toBasePayload());
    router.push("/products");
  }

  if (isLoading || !product) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/products" aria-label="Back to products" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">Edit Product</h1>
          <Link href={`/products/${productId}/info-visual`} className="text-xs font-semibold text-brand-500 hover:underline">
            Info Visual →
          </Link>
          <Link href={`/products/${productId}/comparison`} className="text-xs font-semibold text-brand-500 hover:underline">
            Comparison →
          </Link>
          <Link href="/products/marketing-review" className="text-xs font-semibold text-brand-500 hover:underline">
            Marketing Review Cards →
          </Link>
        </div>
        <div className="flex gap-3">
          <Link href="/products">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </div>

      <ProductFormFields form={form} productId={productId} variants={product.variants} />
    </form>
  );
}
