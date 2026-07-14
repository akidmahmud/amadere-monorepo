"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { BundleItemsFields, type BundleItem } from "@/components/BundleItemsFields";
import { useCreateProductBundle } from "@/hooks/useProductBundles";
import type { PublishStatus } from "@/hooks/useBrands";

export default function NewProductBundlePage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [bundlePrice, setBundlePrice] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [items, setItems] = useState<BundleItem[]>([]);
  const create = useCreateProductBundle();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      slug,
      status,
      bundlePrice: bundlePrice ? Number(bundlePrice) : undefined,
      discountPct: discountPct ? Number(discountPct) : undefined,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
      items: items.filter((i) => i.productId > 0),
    });
    router.push("/product-bundles");
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
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Fixed bundle price (optional)</span>
            <input
              type="number"
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              className="num h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Or discount % (optional)</span>
            <input
              type="number"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              className="num h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
        </div>
        <StatusSelect value={status} onChange={setStatus} />
        <BundleItemsFields items={items} onChange={setItems} />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create bundle"}
          </Button>
          <Link href="/product-bundles">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
