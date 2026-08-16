"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useCreateBlogPost } from "@/hooks/useBlogPosts";
import { BlogPostFormFields } from "@/components/blog/BlogPostFormFields";
import { BlogPreviewButton } from "@/components/blog/BlogPreviewButton";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";

// Fixed key, not per-post (there's no id yet) — same tradeoff as the new
// product page's draft key.
const DRAFT_KEY = "blog-post-draft-new";

interface BlogPostDraft {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaDescription: string;
  imageUrl: string | undefined;
  coverImageUrl: string | undefined;
  isFeatured: boolean;
  sortOrder: number;
  categoryIds: number[];
  tagIds: number[];
}

export default function NewBlogPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>();
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const create = useCreateBlogPost();
  const storefrontUrl = useStorefrontUrl();
  const toast = useToast();
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<BlogPostDraft> | null>(null);

  useEffect(() => {
    setPendingDraft(loadDraft<BlogPostDraft>(DRAFT_KEY));
  }, []);

  useAutosaveDraft(DRAFT_KEY, () => ({
    title, slug, excerpt, content, metaDescription, imageUrl, coverImageUrl, isFeatured, sortOrder, categoryIds, tagIds,
  }));

  function restoreDraft(d: BlogPostDraft) {
    setTitle(d.title);
    setSlug(d.slug);
    setExcerpt(d.excerpt);
    setContent(d.content);
    setMetaDescription(d.metaDescription);
    setImageUrl(d.imageUrl);
    setCoverImageUrl(d.coverImageUrl);
    setIsFeatured(d.isFeatured);
    setSortOrder(d.sortOrder);
    setCategoryIds(d.categoryIds);
    setTagIds(d.tagIds);
  }

  // "Save" creates the post and drops onto its own edit page — same
  // reasoning as the new product page: a brand new post has no id yet, so
  // there's nowhere to see Revision History or SEO tools until it exists.
  // "Save & Exit" is the old always-back-to-the-list behavior, kept for
  // when there's nothing more to add.
  async function handleSave(exit: boolean) {
    let created;
    try {
      created = await create.mutateAsync({
        slug,
        imageUrl,
        coverImageUrl,
        isFeatured,
        sortOrder,
        categoryIds,
        tagIds,
        translations: [
          { locale: "EN", title, excerpt: excerpt || undefined, content, metaDescription: metaDescription || undefined },
          { locale: "BN", title, excerpt: excerpt || undefined, content, metaDescription: metaDescription || undefined },
        ],
      });
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create post");
      return;
    }
    clearDraft(DRAFT_KEY);
    router.push(exit ? "/blog-posts" : `/blog-posts/${created.id}`);
  }

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
          <Link href="/blog-posts" aria-label="Back to blog posts" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">New Blog Post</h1>
        </div>
        <div className="flex gap-3">
          <BlogPreviewButton />
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border px-[18px] font-ui text-sm font-semibold text-text hover:bg-surface-2"
          >
            Visit website
          </a>
          <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => handleSave(true)}>
            {create.isPending ? "Saving…" : "Save & Exit"}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-inner border border-[#d8e6fc] bg-brand-50 px-3.5 py-2.5 text-[0.75rem] font-semibold text-brand-600">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        New posts start as a draft — submit, publish or archive it from the edit page once created.
      </div>

      {pendingDraft && (
        <DraftRestoreBanner
          savedAt={pendingDraft.savedAt}
          onRestore={() => {
            restoreDraft(pendingDraft.data);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            clearDraft(DRAFT_KEY);
            setPendingDraft(null);
          }}
        />
      )}

      <BlogPostFormFields
        title={title}
        setTitle={setTitle}
        slug={slug}
        setSlug={setSlug}
        excerpt={excerpt}
        setExcerpt={setExcerpt}
        content={content}
        setContent={setContent}
        metaDescription={metaDescription}
        setMetaDescription={setMetaDescription}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        coverImageUrl={coverImageUrl}
        setCoverImageUrl={setCoverImageUrl}
        isFeatured={isFeatured}
        setIsFeatured={setIsFeatured}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        categoryIds={categoryIds}
        setCategoryIds={setCategoryIds}
        tagIds={tagIds}
        setTagIds={setTagIds}
      />
    </form>
  );
}
