"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormSkeleton } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useBrand, useDeleteBrand, useUpdateBrand } from "@/hooks/useBrands";
import type { PublishStatus } from "@/hooks/useBrands";
import { useToast } from "@/components/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BrandFormFields } from "@/components/brands/BrandFormFields";

const deleteIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export default function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const brandId = Number(id);
  const router = useRouter();
  const { data: brand, isLoading } = useBrand(brandId);
  const update = useUpdateBrand(brandId);
  const deleteBrand = useDeleteBrand();
  const toast = useToast();

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!brand) return;
    setSlug(brand.slug);
    setName(brand.translations[0]?.name ?? "");
    setDescription(brand.translations[0]?.description ?? "");
    setLogoUrl(brand.logoUrl ?? undefined);
    setWebsiteUrl(brand.websiteUrl ?? "");
    setStatus(brand.status);
    setIsFeatured(brand.isFeatured);
  }, [brand]);

  async function handleDelete() {
    try {
      await deleteBrand.mutateAsync(brandId);
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to delete brand");
      return;
    }
    toast.push(`Brand "${brand?.translations[0]?.name ?? brand?.slug ?? "Brand"}" deleted.`);
    router.push("/brands");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await update.mutateAsync({
        slug,
        logoUrl,
        websiteUrl: websiteUrl || undefined,
        isFeatured,
        status,
        translations: [
          { locale: "EN", name, description: description || undefined },
          { locale: "BN", name, description: description || undefined },
        ],
      });
      toast.push("Brand saved successfully!");
      router.push("/brands");
    } catch (err) {
      const msg = err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save brand";
      setFormError(msg);
      toast.push(msg);
    }
  }

  if (isLoading || !brand) return <FormSkeleton />;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/brands"
            aria-label="Back to brands"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900">Edit Brand</h1>
            {name && (
              <span className="max-w-[260px] truncate rounded-full bg-[#ecfdf5] px-3 py-0.5 text-xs font-bold text-[#059669] border border-[#a7f3d0]">
                {name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/brands">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
          <button
            type="button"
            aria-label="Delete brand"
            title="Delete brand"
            onClick={() => setConfirmDeleteOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition-all hover:bg-rose-600 hover:text-white shadow-2xs"
          >
            {deleteIcon}
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#044e37] px-5 text-xs font-bold text-[#fbbf24] shadow-xs transition-all duration-150 hover:bg-[#033c2a] disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <BrandFormFields
        name={name}
        setName={setName}
        slug={slug}
        setSlug={setSlug}
        description={description}
        setDescription={setDescription}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        status={status}
        setStatus={setStatus}
        isFeatured={isFeatured}
        setIsFeatured={setIsFeatured}
        formError={formError}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        pending={deleteBrand.isPending}
        title={`Delete "${name || brand.slug}"?`}
        description="Are you sure you want to delete this brand? This action will remove the brand entry."
      />
    </form>
  );
}
