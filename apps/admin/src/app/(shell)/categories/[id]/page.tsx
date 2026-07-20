"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import { StatusSelect } from "@/components/StatusSelect";
import { useCategories, useCategory, useUpdateCategory } from "@/hooks/useCategories";
import type { PublishStatus } from "@/hooks/useBrands";

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const categoryId = Number(id);
  const router = useRouter();
  const { data: category, isLoading } = useCategory(categoryId);
  const { data: categories } = useCategories();
  const update = useUpdateCategory(categoryId);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!category) return;
    setSlug(category.slug);
    setName(category.translations[0]?.name ?? "");
    setDescription(category.translations[0]?.description ?? "");
    setParentId(category.parentId ?? undefined);
    setImageUrl(category.imageUrl ?? undefined);
    setIconUrl(category.iconUrl ?? undefined);
    setStatus(category.status);
    setIsFeatured(category.isFeatured);
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      parentId,
      imageUrl,
      iconUrl,
      isFeatured,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
    });
    router.push("/categories");
  }

  if (isLoading || !category) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Slug</span>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Parent category (optional)</span>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="">None (top-level)</option>
              {categories
                ?.filter((c) => c.id !== categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.translations[0]?.name ?? c.slug}
                  </option>
                ))}
            </select>
          </label>
          <MediaPicker value={imageUrl} onChange={setImageUrl} label="Image" />
          <MediaPicker value={iconUrl} onChange={setIconUrl} label="Icon" />
          <StatusSelect value={status} onChange={setStatus} />
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Featured
          </label>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Link href="/categories">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <SeoMetaCard entityType="CATEGORY" entityId={categoryId} />
    </div>
  );
}
