"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { useArchiveBlogPost, useBlogPost, usePublishBlogPost, useSubmitBlogPost, useUpdateBlogPost } from "@/hooks/useBlogPosts";
import { BlogPostFormFields } from "@/components/blog/BlogPostFormFields";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-[#eef1f6] text-[#7a879b]",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const postId = Number(id);
  const router = useRouter();
  const { data: post, isLoading } = useBlogPost(postId);
  const update = useUpdateBlogPost(postId);
  const submit = useSubmitBlogPost();
  const publish = usePublishBlogPost();
  const archive = useArchiveBlogPost();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [isFeatured, setIsFeatured] = useState(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (!post) return;
    setSlug(post.slug);
    setTitle(post.translations[0]?.title ?? "");
    setExcerpt(post.translations[0]?.excerpt ?? "");
    setContent(post.translations[0]?.content ?? "");
    setMetaDescription(post.translations[0]?.metaDescription ?? "");
    setImageUrl(post.imageUrl ?? undefined);
    setIsFeatured(post.isFeatured);
    setCategoryIds(post.categoryIds);
    setTagIds(post.tagIds);
  }, [post]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      imageUrl,
      isFeatured,
      categoryIds,
      tagIds,
      translations: [
        { locale: "EN", title, excerpt: excerpt || undefined, content, metaDescription: metaDescription || undefined },
        { locale: "BN", title, excerpt: excerpt || undefined, content, metaDescription: metaDescription || undefined },
      ],
    });
    router.push("/blog-posts");
  }

  if (isLoading || !post) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
          <a
            href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border px-[18px] font-ui text-sm font-semibold text-text hover:bg-surface-2"
          >
            Visit website
          </a>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Post"}
          </Button>
        </div>
      </div>

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
        isFeatured={isFeatured}
        setIsFeatured={setIsFeatured}
        categoryIds={categoryIds}
        setCategoryIds={setCategoryIds}
        tagIds={tagIds}
        setTagIds={setTagIds}
        statusLabel={post.status.charAt(0) + post.status.slice(1).toLowerCase()}
        statusPillClass={STATUS_PILL[post.status]}
      />
      </form>

      <SeoMetaCard entityType="BLOG_POST" entityId={postId} />
    </div>
  );
}
