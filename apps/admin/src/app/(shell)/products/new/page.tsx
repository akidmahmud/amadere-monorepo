"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useCreateProduct, type VariantInput } from "@/hooks/useProducts";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { useProductFormState } from "@/components/products/useProductFormState";

export default function NewProductPage() {
  const router = useRouter();
  const form = useProductFormState();
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const create = useCreateProduct();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      ...form.toBasePayload(),
      variants: form.hasVariants ? variants : undefined,
    });
    router.push("/products");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-ui text-lg font-extrabold text-text">Add Product</h1>
        <div className="flex gap-3">
          <Link href="/products">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </div>

      <ProductFormFields form={form} newVariants={variants} onNewVariantsChange={setVariants} />
    </form>
  );
}
