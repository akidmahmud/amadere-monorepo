"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useCreateProduct, type VariantInput } from "@/hooks/useProducts";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { ProductPreviewButton } from "@/components/products/ProductPreviewButton";
import { useProductFormState, type ProductFormSnapshot } from "@/components/products/useProductFormState";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";

// Fixed key, not per-product (there's no id yet) — only one "add product"
// tab is realistically open at a time, so this is an acceptable tradeoff
// for not needing a synthetic client-side draft id scheme.
const DRAFT_KEY = "product-draft-new";

// Same base look as the shared Button component's "ghost" variant, but with
// its own hover — see products/[id]/page.tsx's copy of this constant for why
// overriding ghost's hover via className isn't reliable.
const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border bg-transparent px-[18px] font-ui text-sm font-semibold text-text transition-colors duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50";

interface NewProductDraft {
  form: ProductFormSnapshot;
  variants: VariantInput[];
}

export default function NewProductPage() {
  const router = useRouter();
  const form = useProductFormState();
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const create = useCreateProduct();
  const toast = useToast();
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<NewProductDraft> | null>(null);

  useEffect(() => {
    setPendingDraft(loadDraft<NewProductDraft>(DRAFT_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutosaveDraft(DRAFT_KEY, () => ({ form: form.getSnapshot(), variants }));

  // "Save" creates the product and drops onto its own edit page — a brand
  // new product has no id yet, so there's nowhere to add media/variants/SEO
  // until it exists; jumping straight to /products/{id} instead of back to
  // the list lets that continue in one flow. "Save & Exit" is the old
  // always-back-to-the-list behavior, kept for when there's nothing more to add.
  async function handleSave(exit: boolean) {
    let created;
    try {
      created = await create.mutateAsync({
        ...form.toBasePayload(),
        variants: form.hasVariants ? variants : undefined,
      });
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create product");
      return;
    }
    clearDraft(DRAFT_KEY);
    router.push(exit ? "/products" : `/products/${created.id}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave(false);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h1 className="font-ui text-lg font-extrabold text-text">Add Product</h1>
        <div className="flex gap-3">
          <Link href="/products">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
          <ProductPreviewButton />
          <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => handleSave(true)}>
            {create.isPending ? "Saving…" : "Save & Exit"}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {pendingDraft && (
        <DraftRestoreBanner
          savedAt={pendingDraft.savedAt}
          onRestore={() => {
            form.applySnapshot(pendingDraft.data.form);
            setVariants(pendingDraft.data.variants);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            clearDraft(DRAFT_KEY);
            setPendingDraft(null);
          }}
        />
      )}

      <ProductFormFields form={form} newVariants={variants} onNewVariantsChange={setVariants} />
    </form>
  );
}
