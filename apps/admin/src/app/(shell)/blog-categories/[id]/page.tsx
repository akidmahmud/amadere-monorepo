"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { useBlogCategories, useBlogCategory, useUpdateBlogCategory } from "@/hooks/useBlogCategories";
import type { PublishStatus } from "@/hooks/useBrands";

export default function EditBlogCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const categoryId = Number(id);
  const router = useRouter();
  const { data: category, isLoading } = useBlogCategory(categoryId);
  const { data: categories } = useBlogCategories();
  const update = useUpdateBlogCategory(categoryId);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [status, setStatus] = useState<PublishStatus>("DRAFT");

  useEffect(() => {
    if (!category) return;
    setSlug(category.slug);
    setName(category.translations[0]?.name ?? "");
    setDescription(category.translations[0]?.description ?? "");
    setParentId(category.parentId ?? undefined);
    setStatus(category.status);
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      parentId,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
    });
    router.push("/blog-categories");
  }

  if (isLoading || !category) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Parent category (optional)</span>
          <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
            <option value="">None (top-level)</option>
            {categories?.filter((c) => c.id !== categoryId).map((c) => (
              <option key={c.id} value={c.id}>{c.translations[0]?.name ?? c.slug}</option>
            ))}
          </select>
        </label>
        <StatusSelect value={status} onChange={setStatus} />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/blog-categories">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
