"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { ProductInfoVisualFields } from "@/components/products/ProductInfoVisualFields";
import { useProductFormState } from "@/components/products/useProductFormState";

export default function ProductInfoVisualPage({ params }: { params: Promise<{ id: string }> }) {
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
    router.push(`/products/${productId}`);
  }

  if (isLoading || !product) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text">Product Info Visual — {product.translations[0]?.name ?? product.slug}</p>
        <Link href={`/products/${productId}`} className="text-xs font-semibold text-brand-500 hover:underline">
          ← Back to product
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <ProductInfoVisualFields form={form} />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href={`/products/${productId}`}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
