"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, FormSkeleton } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useDeleteProduct, useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { useToast } from "@/components/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useProductFormState, type ProductFormSnapshot } from "@/components/products/useProductFormState";
import { DigitalProductFormFields } from "@/components/digital-products/DigitalProductFormFields";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";
import { STICKY_FORM_HEADER } from "@/lib/sticky-form-header";

const deleteIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border bg-transparent px-[18px] font-ui text-sm font-semibold text-text transition-colors duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50";

export default function EditDigitalProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productId = Number(id);
  const draftKey = `digital-product-draft-${productId}`;
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const form = useProductFormState();
  const update = useUpdateProduct(productId);
  const deleteProduct = useDeleteProduct();
  const toast = useToast();
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<ProductFormSnapshot> | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function handleDelete() {
    try {
      await deleteProduct.mutateAsync(productId);
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to delete product");
      return;
    }
    clearDraft(draftKey);
    toast.push(`"${product?.translations[0]?.name ?? product?.slug ?? "Product"}" deleted.`);
    router.push("/digital-products");
  }

  useEffect(() => {
    if (!product) return;
    form.seedFrom(product);
    // Same inert-default rationale as the New Digital Product page — an
    // older digital product saved before a shippableWeight/trackInventory
    // seam existed here shouldn't get blocked on Save by a field this form
    // never shows.
    if (!product.shippableWeight) form.setShippableWeight("0");
    if (product.trackInventory) form.setTrackInventory(false);
    setPendingDraft(loadDraft<ProductFormSnapshot>(draftKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  useAutosaveDraft(draftKey, form.getSnapshot);

  async function handleSave(exit: boolean) {
    const missing = form.validate(0);
    if (missing.length > 0) {
      toast.push(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }
    try {
      await update.mutateAsync(form.toBasePayload());
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save product");
      return;
    }
    clearDraft(draftKey);
    if (exit) router.push("/digital-products");
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
      <div className={STICKY_FORM_HEADER}>
        <div className="flex items-center gap-3">
          <Link href="/digital-products" aria-label="Back to digital products" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">Edit Digital Product</h1>
          {form.name && (
            <span className="max-w-[320px] truncate text-sm font-semibold text-text" title={form.name}>
              — {form.name}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/digital-products">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
          <button
            type="button"
            aria-label="Delete product"
            title="Delete product"
            onClick={() => setConfirmDeleteOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-danger/40 bg-transparent text-danger transition-colors duration-150 hover:bg-danger hover:text-white"
          >
            {deleteIcon}
          </button>
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

      <DigitalProductFormFields form={form} productId={productId} product={product} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        pending={deleteProduct.isPending}
        title={`Delete "${form.name || product.slug}"?`}
        description="This moves the product to Trash, not a permanent delete — a super admin can restore it from Product Management → Deleted Products within 30 days. After that it's gone for good."
      />
    </form>
  );
}
