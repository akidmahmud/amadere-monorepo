"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAttributes } from "@/hooks/useAttributes";
import { useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { useProductFormState } from "@/components/products/useProductFormState";
import { ExistingVariantsManager } from "@/components/products/ExistingVariantsManager";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { CrossSellFields } from "@/components/products/CrossSellFields";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productId = Number(id);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const { data: attributes } = useAttributes();
  const form = useProductFormState();
  const update = useUpdateProduct(productId);

  useEffect(() => {
    if (product) form.seedFrom(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const selectedAttributes = attributes?.filter((a) => form.attributeIds.includes(a.id)) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form.toBasePayload());
    router.push("/products");
  }

  if (isLoading || !product) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-2xl">
        <div className="mb-2 flex justify-end gap-4">
          <Link href={`/products/${productId}/info-visual`} className="text-xs font-semibold text-brand-500 hover:underline">
            Edit Product Info Visual →
          </Link>
          <Link href={`/products/${productId}/comparison`} className="text-xs font-semibold text-brand-500 hover:underline">
            Edit Comparison Section →
          </Link>
          <Link href="/products/marketing-review" className="text-xs font-semibold text-brand-500 hover:underline">
            Manage Marketing Review Cards →
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <ProductFormFields form={form} />

          {form.hasVariants && (
            <ExistingVariantsManager productId={productId} attributes={selectedAttributes} variants={product.variants} />
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Link href="/products">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <CrossSellFields productId={productId} />

      <SeoMetaCard entityType="PRODUCT" entityId={productId} />
    </div>
  );
}
