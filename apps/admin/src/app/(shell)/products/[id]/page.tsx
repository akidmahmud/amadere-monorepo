"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, FormSkeleton } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { useToast } from "@/components/ToastProvider";
import { ProductFormFields } from "@/components/products/ProductFormFields";
import { ProductPreviewButton } from "@/components/products/ProductPreviewButton";
import { useProductFormState, type ProductFormSnapshot } from "@/components/products/useProductFormState";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";

// Same base look as the shared Button component's "ghost" variant, but with
// its own hover — the ghost variant's hover:bg-surface-2 is a plain string
// class alongside no tailwind-merge, so overriding it via a className prop
// isn't reliable (whichever utility wins depends on CSS generation order,
// not prop order). A plain element sidesteps that entirely.
const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border bg-transparent px-[18px] font-ui text-sm font-semibold text-text transition-colors duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productId = Number(id);
  const draftKey = `product-draft-${productId}`;
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const form = useProductFormState();
  const update = useUpdateProduct(productId);
  const toast = useToast();
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<ProductFormSnapshot> | null>(null);

  useEffect(() => {
    if (!product) return;
    form.seedFrom(product);
    // A crash/outage before the last real save leaves a draft behind —
    // useUpdateProduct's own successful saves always clear it (see
    // handleSave), so any draft still here at load time is exactly that:
    // unsaved work from before whatever interrupted the previous session.
    setPendingDraft(loadDraft<ProductFormSnapshot>(draftKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  useAutosaveDraft(draftKey, form.getSnapshot);

  // "Save" stays on this page (re-seeds the form from the freshly-saved
  // data once useProduct's query invalidates) so multi-tab edits — General,
  // then Media, then Variants — don't force a re-navigate back in after
  // every single change. "Save & Exit" is the old always-redirect behavior,
  // kept as its own explicit action for when the edit really is done.
  async function handleSave(exit: boolean) {
    try {
      await update.mutateAsync(form.toBasePayload());
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save product");
      return;
    }
    clearDraft(draftKey);
    if (exit) router.push("/products");
  }

  if (isLoading || !product) return <FormSkeleton />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave(false);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/products" aria-label="Back to products" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">Edit Product</h1>
          {form.name && (
            <span className="max-w-[320px] truncate text-sm font-semibold text-text" title={form.name}>
              — {form.name}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/products">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
          <ProductPreviewButton productId={productId} slug={product.slug} />
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={() => handleSave(true)}>
            {update.isPending ? "Saving…" : "Save & Exit"}
          </Button>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {pendingDraft && (
        <DraftRestoreBanner
          savedAt={pendingDraft.savedAt}
          onRestore={() => {
            form.applySnapshot(pendingDraft.data);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            clearDraft(draftKey);
            setPendingDraft(null);
          }}
        />
      )}

      <ProductFormFields form={form} productId={productId} variants={product.variants} />
    </form>
  );
}
