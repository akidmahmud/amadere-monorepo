"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreateBrand } from "@/hooks/useBrands";
import type { PublishStatus } from "@/hooks/useBrands";

export default function NewBrandPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const create = useCreateBrand();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      slug,
      logoUrl,
      websiteUrl: websiteUrl || undefined,
      isFeatured,
      sortOrder: 0,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
    });
    router.push("/brands");
  }

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
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create brand"}
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
