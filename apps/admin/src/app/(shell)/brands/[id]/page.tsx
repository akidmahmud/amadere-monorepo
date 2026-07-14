"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { StatusSelect } from "@/components/StatusSelect";
import { useBrand, useUpdateBrand } from "@/hooks/useBrands";
import type { PublishStatus } from "@/hooks/useBrands";

export default function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const brandId = Number(id);
  const router = useRouter();
  const { data: brand, isLoading } = useBrand(brandId);
  const update = useUpdateBrand(brandId);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!brand) return;
    setSlug(brand.slug);
    setName(brand.translations[0]?.name ?? "");
    setDescription(brand.translations[0]?.description ?? "");
    setLogoUrl(brand.logoUrl ?? undefined);
    setWebsiteUrl(brand.websiteUrl ?? "");
    setStatus(brand.status);
    setIsFeatured(brand.isFeatured);
  }, [brand]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      logoUrl,
      websiteUrl: websiteUrl || undefined,
      isFeatured,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
    });
    router.push("/brands");
  }

  if (isLoading || !brand) return <p className="text-sm text-muted">Loading…</p>;

  return (
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
        <MediaPicker value={logoUrl} onChange={setLogoUrl} label="Logo" />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Website URL (optional)</span>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <StatusSelect value={status} onChange={setStatus} />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Featured
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/brands">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
