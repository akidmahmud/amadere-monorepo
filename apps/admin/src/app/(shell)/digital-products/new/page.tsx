"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useCreateProduct } from "@/hooks/useProducts";
import { useProductFormState, type ProductFormSnapshot } from "@/components/products/useProductFormState";
import { DigitalProductFormFields } from "@/components/digital-products/DigitalProductFormFields";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";

// Fixed key, not per-product (there's no id yet) — same rationale as
// products/new/page.tsx's own DRAFT_KEY, kept separate so it never collides
// with an in-progress physical-product draft.
const DRAFT_KEY = "digital-product-draft-new";

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border bg-transparent px-[18px] font-ui text-sm font-semibold text-text transition-colors duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50";

export default function NewDigitalProductPage() {
  const router = useRouter();
  const form = useProductFormState();
  const create = useCreateProduct();
  const toast = useToast();
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<ProductFormSnapshot> | null>(null);

  // Forced here, not left to the backend alone — creating from this section
  // must always create a DIGITAL product. trackInventory/shippableWeight are
  // meaningless for a PDF (no stock, no shipping) but useProductFormState's
  // validate() still requires a shippableWeight and, when trackInventory is
  // on, a stock value — can't fork that hook, so these two are seeded to
  // inert defaults here instead of exposing them in the digital form's UI.
  useEffect(() => {
    form.setProductType("DIGITAL");
    form.setTrackInventory(false);
    if (!form.shippableWeight.trim()) form.setShippableWeight("0");
    setPendingDraft(loadDraft<ProductFormSnapshot>(DRAFT_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutosaveDraft(DRAFT_KEY, form.getSnapshot);

  async function handleSave(exit: boolean) {
    const missing = form.validate(0);
    if (missing.length > 0) {
      toast.push(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }
    let created;
    try {
      created = await create.mutateAsync({ ...form.toBasePayload(), productType: "DIGITAL" });
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create product");
      return;
    }
    clearDraft(DRAFT_KEY);
    // Straight to its own edit page, same reasoning as the physical New
    // Product page: the PDF upload needs a real product id, which doesn't
    // exist until this first save happens.
    router.push(exit ? "/digital-products" : `/digital-products/${created.id}`);
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
        <h1 className="font-ui text-lg font-extrabold text-text">Add Digital Product</h1>
        <div className="flex gap-3">
          <Link href="/digital-products">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
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
            form.applySnapshot(pendingDraft.data);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            clearDraft(DRAFT_KEY);
            setPendingDraft(null);
          }}
        />
      )}

      <DigitalProductFormFields form={form} />
    </form>
  );
}
