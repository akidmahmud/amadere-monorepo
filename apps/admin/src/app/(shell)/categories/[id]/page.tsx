"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, FormSkeleton } from "@amader/admin-ui";
import {
  CategoryFormFields,
  countWords,
  DESCRIPTION_MAX_WORDS,
} from "@/components/categories/CategoryFormFields";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { CategoryProductsCard } from "@/components/categories/CategoryProductsCard";
import { useCategory, useUpdateCategory } from "@/hooks/useCategories";
import type { PublishStatus } from "@/hooks/useBrands";
import { STICKY_FORM_HEADER } from "@/lib/sticky-form-header";

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const categoryId = Number(id);
  const router = useRouter();
  const { data: category, isLoading } = useCategory(categoryId);
  const update = useUpdateCategory(categoryId);

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    const en = category.translations.find((t) => t.locale === "EN");
    const bn = category.translations.find((t) => t.locale === "BN");
    setSlug(category.slug);
    setNameEn(en?.name ?? category.translations[0]?.name ?? "");
    setNameBn(bn?.name ?? "");
    setDescriptionEn(en?.description ?? "");
    setDescriptionBn(bn?.description ?? "");
    setParentId(category.parentId ?? undefined);
    setImageUrl(category.imageUrl ?? undefined);
    setIconUrl(category.iconUrl ?? undefined);
    setBannerImageUrl(category.bannerImageUrl ?? undefined);
    setStatus(category.status);
    setIsFeatured(category.isFeatured);
    setProductIds(category.productIds ?? []);
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      countWords(descriptionEn) > DESCRIPTION_MAX_WORDS ||
      countWords(descriptionBn) > DESCRIPTION_MAX_WORDS
    ) {
      setFormError(
        `Description can't be more than ${DESCRIPTION_MAX_WORDS} words.`,
      );
      return;
    }
    setFormError(null);
    await update.mutateAsync({
      slug,
      parentId,
      imageUrl,
      iconUrl,
      bannerImageUrl,
      isFeatured,
      status,
      productIds,
      translations: [
        { locale: "EN", name: nameEn, description: descriptionEn || undefined },
        { locale: "BN", name: nameBn, description: descriptionBn || undefined },
      ],
    });
    router.push("/categories");
  }

  if (isLoading || !category) return <FormSkeleton />;

  const displayName =
    category.translations.find((t) => t.locale === "EN")?.name ??
    category.translations[0]?.name ??
    category.slug;

  return (
    <div className="flex flex-col gap-4">
      {/* Outside the <form> on purpose. A sticky element only stays
          pinned while its PARENT is on screen, and this page puts
          SeoMetaCard (which has a form of its own, so it cannot be
          nested inside this one) after the form — so a bar parented to
          the form scrolled away as soon as the form ended. Parented to
          the outer div it spans the whole page; the submit button keeps
          its form via the `form` attribute. */}
        <div className={STICKY_FORM_HEADER}>
          <div className="flex items-center gap-3">
            <Link
              href="/categories"
              aria-label="Back to categories"
              className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <h1 className="font-ui text-lg font-extrabold text-text">
              Edit {displayName}
            </h1>
          </div>
          <div className="flex gap-3">
            <Link href="/categories">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" form="category-form" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div className="flex items-start gap-2.5 rounded-inner border border-[#d8e6fc] bg-brand-50 px-3.5 py-2.5 text-[0.75rem] font-semibold text-brand-600">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 flex-none"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>
            A category is a place in your storefront&apos;s browsing tree — keep
            both languages accurate so it reads correctly for every customer.
            <br />
            <span lang="bn">
              একটি ক্যাটেগরি আপনার স্টোরফ্রন্টের ব্রাউজিং তালিকার একটি জায়গা —
              উভয় ভাষা সঠিক রাখুন যাতে প্রতিটি গ্রাহক সঠিকভাবে দেখতে পারেন।
            </span>
          </span>
        </div>

        {formError && (
          <div className="flex items-center gap-2.5 rounded-inner border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[0.75rem] font-semibold text-danger">
            {formError}
          </div>
        )}

        <CategoryFormFields
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
          parentId={parentId}
          setParentId={setParentId}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          iconUrl={iconUrl}
          setIconUrl={setIconUrl}
          bannerImageUrl={bannerImageUrl}
          setBannerImageUrl={setBannerImageUrl}
          status={status}
          setStatus={setStatus}
          isFeatured={isFeatured}
          setIsFeatured={setIsFeatured}
          excludeId={categoryId}
        />

        <CategoryProductsCard selected={productIds} onChange={setProductIds} />
      </form>

      <SeoMetaCard
        entityType="CATEGORY"
        entityId={categoryId}
        slug={slug}
        previewPath="/categories"
        fallbackTitle={nameEn}
        fallbackDescription={descriptionEn}
      />
    </div>
  );
}
