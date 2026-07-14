"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAttributes } from "@/hooks/useAttributes";
import { useCreateProduct, type VariantInput } from "@/hooks/useProducts";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { useProductFormState } from "@/components/products/useProductFormState";
import { NewVariantsBuilder } from "@/components/products/NewVariantsBuilder";

export default function NewProductPage() {
  const router = useRouter();
  const form = useProductFormState();
  const { data: attributes } = useAttributes();
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const create = useCreateProduct();

  const selectedAttributes = attributes?.filter((a) => form.attributeIds.includes(a.id)) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      ...form.toBasePayload(),
      variants: form.hasVariants ? variants : undefined,
    });
    router.push("/products");
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <ProductFormFields form={form} />

        {form.hasVariants && (
          <NewVariantsBuilder attributes={selectedAttributes} variants={variants} onChange={setVariants} />
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create product"}
          </Button>
          <Link href="/products">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
