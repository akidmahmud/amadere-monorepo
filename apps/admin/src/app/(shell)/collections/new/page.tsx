"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { CollectionFormFields } from "@/components/collections/CollectionFormFields";
import { useCreateCollection } from "@/hooks/useCollections";
import type { PublishStatus } from "@/hooks/useBrands";

export default function NewCollectionPage() {
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [slug, setSlug] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [showInNav, setShowInNav] = useState(false);
  const [productIds, setProductIds] = useState<number[]>([]);
  const create = useCreateCollection();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      slug,
      status,
      sortOrder: 0,
      showInNav,
      translations: [
        { locale: "EN", name: nameEn, description: descriptionEn || undefined },
        { locale: "BN", name: nameBn, description: descriptionBn || undefined },
      ],
      products: productIds.map((productId, i) => ({ productId, sortOrder: i })),
    });
    router.push("/collections");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/collections" aria-label="Back to collections" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">New Collection</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/collections">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create collection"}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-inner border border-[#d8e6fc] bg-brand-50 px-3.5 py-2.5 text-[0.75rem] font-semibold text-brand-600">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>
          A collection groups products for a homepage section, promotion, or navbar link — set both languages so it reads
          correctly for every customer.
          <br />
          <span lang="bn">
            একটি কালেকশন হোমপেজ সেকশন, প্রচারণা বা নেভবার লিংকের জন্য পণ্য একত্র করে — উভয় ভাষা পূরণ করুন যাতে প্রতিটি গ্রাহক সঠিকভাবে
            দেখতে পারেন।
          </span>
        </span>
      </div>

      <CollectionFormFields
        nameEn={nameEn}
        setNameEn={setNameEn}
        nameBn={nameBn}
        setNameBn={setNameBn}
        slug={slug}
        setSlug={setSlug}
        descriptionEn={descriptionEn}
        setDescriptionEn={setDescriptionEn}
        descriptionBn={descriptionBn}
        setDescriptionBn={setDescriptionBn}
        status={status}
        setStatus={setStatus}
        showInNav={showInNav}
        setShowInNav={setShowInNav}
        productIds={productIds}
        setProductIds={setProductIds}
      />
    </form>
  );
}
