"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@amader/admin-ui";
import { useCreateBlogPost } from "@/hooks/useBlogPosts";
import { BlogPostFormFields } from "@/components/blog/BlogPostFormFields";

export default function NewBlogPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [isFeatured, setIsFeatured] = useState(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const create = useCreateBlogPost();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <a
            href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border px-[18px] font-ui text-sm font-semibold text-text hover:bg-surface-2"
          >
            Visit website
          </a>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create Post"}
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
      />
    </form>
  );
}
