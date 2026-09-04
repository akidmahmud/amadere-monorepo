"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import {
  CategoryFormFields,
  countWords,
  DESCRIPTION_MAX_WORDS,
} from "@/components/categories/CategoryFormFields";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { useCreateCategory } from "@/hooks/useCategories";
import { useUpsertSeoMeta } from "@/hooks/useSeoMeta";
import type { PublishStatus } from "@/hooks/useBrands";
import { STICKY_FORM_HEADER } from "@/lib/sticky-form-header";
import { useToast } from "@/components/ToastProvider";

export default function NewCategoryPage() {
  const router = useRouter();
  const toast = useToast();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [slug, setSlug] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const create = useCreateCategory();
  const upsertSeo = useUpsertSeoMeta();

  async function handleSave(exit: boolean) {
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
    const created = await create.mutateAsync({
      slug,
      parentId,
      imageUrl,
      iconUrl,
      bannerImageUrl,
      isFeatured,
      sortOrder: 0,
      status,
      translations: [
        { locale: "EN", name: nameEn, description: descriptionEn || undefined },
        { locale: "BN", name: nameBn, description: descriptionBn || undefined },
      ],
    });
    // SEO meta is its own row keyed by entityId, which doesn't exist until
    // the category above is actually created — this is the two-step this
    // form hides from the admin (see SeoMetaCard's "buffered mode" doc).
    if (seoTitle.trim() || seoDescription.trim()) {
      await upsertSeo.mutateAsync({
        entityType: "CATEGORY",
        entityId: created.id,
        locale: "EN",
        title: seoTitle || undefined,
        description: seoDescription || undefined,
        robots: "index,follow",
      });
    }
    if (exit) {
      // Same highlight as the edit page — a category you just created is
      // exactly the row you want to find in the list.
      router.push(`/categories?highlight=${created.id}`);
      return;
    }
    // A new category has no edit URL until it exists, so "Save" hands over to
    // its own page rather than staying on a create form that would make a
    // second category on the next submit. `replace`, so Back goes to the list
    // and not to a create form that has already been used.
    toast.push("Category created");
    router.replace(`/categories/${created.id}`);
  }

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
              New Category
            </h1>
          </div>
          <div className="flex gap-3">
            <Link href="/categories">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              disabled={create.isPending}
              onClick={() => handleSave(true)}
            >
              {create.isPending ? "Saving…" : "Save & Exit"}
            </Button>
            <Button type="submit" form="category-form" variant="primary" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create category"}
            </Button>
          </div>
        </div>
      <form
        id="category-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        className="flex flex-col gap-4"
      >

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
            A category is a place in your storefront&apos;s browsing tree — set
            both languages so it reads correctly for every customer.
            <br />
            <span lang="bn">
              একটি ক্যাটেগরি আপনার স্টোরফ্রন্টের ব্রাউজিং তালিকার একটি জায়গা —
              উভয় ভাষা পূরণ করুন যাতে প্রতিটি গ্রাহক সঠিকভাবে দেখতে পারেন।
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
        />
      </form>

      <SeoMetaCard
        entityType="CATEGORY"
        slug={slug}
        previewPath="/categories"
        fallbackTitle={nameEn}
        fallbackDescription={descriptionEn}
        value={{ title: seoTitle, description: seoDescription }}
        onChange={(v) => {
          setSeoTitle(v.title);
          setSeoDescription(v.description);
        }}
      />
    </div>
  );
}
