"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useCreateBrand } from "@/hooks/useBrands";
import type { PublishStatus } from "@/hooks/useBrands";
import { useToast } from "@/components/ToastProvider";
import { BrandFormFields } from "@/components/brands/BrandFormFields";

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export default function NewBrandPage() {
  const router = useRouter();
  const create = useCreateBrand();
  const toast = useToast();

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await create.mutateAsync({
        slug,
        logoUrl,
        websiteUrl: websiteUrl || undefined,
        isFeatured,
        sortOrder: 0,
        status,
        translations: [
          { locale: "EN", name, description: description || undefined },
          { locale: "BN", name, description: description || undefined },
        ],
      });
      toast.push("Brand created successfully!");
      router.push("/brands");
    } catch (err) {
      const msg = err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create brand";
      setFormError(msg);
      toast.push(msg);
    }
  }

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
            <h1 className="text-lg font-extrabold text-slate-900">Create New Brand</h1>
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
            type="submit"
            disabled={create.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#044e37] px-5 text-xs font-bold text-[#fbbf24] shadow-xs transition-all duration-150 hover:bg-[#033c2a] disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create Brand"}
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
    </form>
  );
}
