"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { usePickerProducts } from "@/hooks/usePickers";
import { useCollection, useUpdateCollection } from "@/hooks/useCollections";
import type { PublishStatus } from "@/hooks/useBrands";

export default function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const collectionId = Number(id);
  const router = useRouter();
  const { data: collection, isLoading } = useCollection(collectionId);
  const { data: products, isLoading: loadingProducts } = usePickerProducts();
  const update = useUpdateCollection(collectionId);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [productIds, setProductIds] = useState<number[]>([]);

  useEffect(() => {
    if (!collection) return;
    setSlug(collection.slug);
    setName(collection.translations[0]?.name ?? "");
    setDescription(collection.translations[0]?.description ?? "");
    setStatus(collection.status);
    setProductIds([...collection.products].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.productId));
  }, [collection]);

  function toggleProduct(pid: number) {
    setProductIds((prev) => (prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
      products: productIds.map((productId, i) => ({ productId, sortOrder: i })),
    });
    router.push("/collections");
  }

  if (isLoading || !collection) return <p className="text-sm text-muted">Loading…</p>;

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
        <StatusSelect value={status} onChange={setStatus} />

        <div>
          <span className="mb-2 block text-xs font-semibold text-secondary">
            Products (checked in the order you click them)
          </span>
          {loadingProducts && <p className="text-sm text-muted">Loading…</p>}
          <div className="flex flex-col gap-1.5">
            {products?.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.label}
                {productIds.includes(p.id) && (
                  <span className="text-xs text-muted">#{productIds.indexOf(p.id) + 1}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/collections">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
