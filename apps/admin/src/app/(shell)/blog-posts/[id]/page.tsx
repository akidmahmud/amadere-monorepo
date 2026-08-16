"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, FormSkeleton, Tabs } from "@amader/admin-ui";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import {
  useArchiveBlogPost,
  useBlogPost,
  usePublishBlogPost,
  useSubmitBlogPost,
  useUpdateBlogPost,
} from "@/hooks/useBlogPosts";
import { BlogPostFormFields } from "@/components/blog/BlogPostFormFields";
import { BlogPreviewButton } from "@/components/blog/BlogPreviewButton";
import { RevisionHistoryTable } from "@/components/blog/RevisionHistoryTable";
import { useAutosaveDraft, loadDraft, clearDraft, type StoredDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoreBanner } from "@/components/DraftRestoreBanner";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";

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

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-[#eef1f6] text-[#7a879b]",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const postId = Number(id);
  const draftKey = `blog-post-draft-${postId}`;
  const router = useRouter();
  const { data: post, isLoading } = useBlogPost(postId);
  const update = useUpdateBlogPost(postId);
  const submit = useSubmitBlogPost();
  const publish = usePublishBlogPost();
  const archive = useArchiveBlogPost();
  const storefrontUrl = useStorefrontUrl();
  const toast = useToast();

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
  const [activeTab, setActiveTab] = useState<"detail" | "revisions">("detail");
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<BlogPostDraft> | null>(null);

  useEffect(() => {
    if (!post) return;
    setSlug(post.slug);
    setTitle(post.translations[0]?.title ?? "");
    setExcerpt(post.translations[0]?.excerpt ?? "");
    setContent(post.translations[0]?.content ?? "");
    setMetaDescription(post.translations[0]?.metaDescription ?? "");
    setImageUrl(post.imageUrl ?? undefined);
    setCoverImageUrl(post.coverImageUrl ?? undefined);
    setIsFeatured(post.isFeatured);
    setSortOrder(post.sortOrder);
    setCategoryIds(post.categoryIds);
    setTagIds(post.tagIds);
    // Same reasoning as the product edit page: useUpdateBlogPost's own
    // successful saves always clear this draft, so anything still here at
    // load time is unsaved work from before a crash/outage.
    setPendingDraft(loadDraft<BlogPostDraft>(draftKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  useAutosaveDraft(draftKey, () => ({
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

  // "Save" stays on this page (same reasoning as the product edit page —
  // multi-tab edits shouldn't force a re-navigate after every change).
  // "Save & Exit" is the old always-redirect behavior, kept as its own
  // explicit action for when the edit really is done.
  async function handleSave(exit: boolean) {
    try {
      await update.mutateAsync({
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
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save post");
      return;
    }
    clearDraft(draftKey);
    if (exit) router.push("/blog-posts");
  }

  if (isLoading || !post) return <FormSkeleton />;

  return (
    <div className="flex flex-col gap-4 min-w-0 max-w-full">
      {/* SeoMetaCard below renders its own <form> with its own Save button —
          nesting it inside this page's <form> is invalid HTML (and React
          warns/hydration-errors on it), so only the Detail tab's own fields
          go inside this <form>; SeoMetaCard stays a sibling underneath it. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        className="flex flex-col gap-4 min-w-0 max-w-full"
      >
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <Link href="/blog-posts" aria-label="Back to blog posts" className="grid h-[34px] w-[34px] place-items-center rounded-inner text-text hover:bg-surface-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="font-ui text-lg font-extrabold text-text">Edit Blog Post</h1>
          {post.status === "DRAFT" && (
            <Button type="button" variant="ghost" disabled={submit.isPending} onClick={() => submit.mutate(postId)}>
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          {post.status === "PENDING" && (
            <Button type="button" variant="primary" disabled={publish.isPending} onClick={() => publish.mutate(postId)}>
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
          {post.status === "PUBLISHED" && (
            <Button type="button" variant="ghost" disabled={archive.isPending} onClick={() => archive.mutate(postId)}>
              {archive.isPending ? "Archiving…" : "Archive"}
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <BlogPreviewButton postId={postId} slug={post.slug} />
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border px-[18px] font-ui text-sm font-semibold text-text hover:bg-surface-2"
          >
            Visit website
          </a>
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
            restoreDraft(pendingDraft.data);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            clearDraft(draftKey);
            setPendingDraft(null);
          }}
        />
      )}

      <Tabs
        options={[
          { value: "detail", label: "Detail" },
          { value: "revisions", label: "Revision History" },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as "detail" | "revisions")}
      />

      {activeTab === "detail" ? (
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
          statusLabel={post.status.charAt(0) + post.status.slice(1).toLowerCase()}
          statusPillClass={STATUS_PILL[post.status]}
        />
      ) : (
        <RevisionHistoryTable postId={postId} />
      )}
      </form>

      {activeTab === "detail" && (
        <SeoMetaCard
          entityType="BLOG_POST"
          entityId={postId}
          slug={slug}
          previewPath="/blog"
          fallbackTitle={title}
          fallbackDescription={excerpt || metaDescription}
        />
      )}
    </div>
  );
}
