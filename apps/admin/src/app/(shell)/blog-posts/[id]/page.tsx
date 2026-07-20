"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { HtmlImportButton } from "@/components/HtmlImportModal";
import { MediaPicker } from "@/components/MediaPicker";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { useBlogCategories } from "@/hooks/useBlogCategories";
import { useBlogTags } from "@/hooks/useBlogTags";
import { useArchiveBlogPost, useBlogPost, usePublishBlogPost, useSubmitBlogPost, useUpdateBlogPost } from "@/hooks/useBlogPosts";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const postId = Number(id);
  const router = useRouter();
  const { data: post, isLoading } = useBlogPost(postId);
  const { data: categories } = useBlogCategories();
  const { data: tags } = useBlogTags();
  const update = useUpdateBlogPost(postId);
  const submit = useSubmitBlogPost();
  const publish = usePublishBlogPost();
  const archive = useArchiveBlogPost();

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
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

  function toggle(list: number[], id: number, set: (ids: number[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

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
    <div className="flex flex-col gap-6">
      <Card className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-secondary">Status</span>
          <p className="text-sm font-semibold text-text">{post.status}</p>
        </div>
        <div className="flex gap-2">
          {post.status === "DRAFT" && (
            <Button type="button" variant="ghost" disabled={submit.isPending} onClick={() => submit.mutate(postId)}>
              Submit for review
            </Button>
          )}
          {post.status === "PENDING" && (
            <Button type="button" variant="primary" disabled={publish.isPending} onClick={() => publish.mutate(postId)}>
              Publish
            </Button>
          )}
          {post.status === "PUBLISHED" && (
            <Button type="button" variant="ghost" disabled={archive.isPending} onClick={() => archive.mutate(postId)}>
              Archive
            </Button>
          )}
        </div>
      </Card>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Title</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Slug</span>
            <input required value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Excerpt (optional)</span>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary">Content</span>
              <HtmlImportButton onImport={setContent} />
            </div>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Meta description (optional)</span>
            <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className={inputClass} />
          </label>
          <MediaPicker value={imageUrl} onChange={setImageUrl} label="Cover image" />
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Featured
          </label>

          <div>
            <span className="mb-2 block text-xs font-semibold text-secondary">Categories</span>
            <div className="flex flex-wrap gap-2">
              {categories?.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                  <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggle(categoryIds, c.id, setCategoryIds)} />
                  {c.translations[0]?.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold text-secondary">Tags</span>
            <div className="flex flex-wrap gap-2">
              {tags?.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                  <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(tagIds, t.id, setTagIds)} />
                  {t.translations[0]?.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Link href="/blog-posts">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </Card>

      <SeoMetaCard entityType="BLOG_POST" entityId={postId} />
    </div>
  );
}
