"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useMarketingReviewCards, useUpdateMarketingReviewCard } from "@/hooks/useMarketingReviewCards";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditMarketingReviewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const cardId = Number(id);
  const router = useRouter();
  const { data: items, isLoading } = useMarketingReviewCards();
  const item = items?.find((i) => i.id === cardId);
  const update = useUpdateMarketingReviewCard(cardId);

  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [captionEn, setCaptionEn] = useState("");
  const [captionBn, setCaptionBn] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!item) return;
    setImageUrl(item.imageUrl);
    setCaptionEn(item.translations[0]?.caption ?? "");
    setCaptionBn(item.translations[1]?.caption ?? "");
    setIsActive(item.isActive);
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) return;
    await update.mutateAsync({
      imageUrl,
      isActive,
      translations: [
        { locale: "EN", caption: captionEn || undefined },
        { locale: "BN", caption: captionBn || undefined },
      ],
    });
    router.push("/products/marketing-review");
  }

  if (isLoading || !item) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <MediaPicker value={imageUrl} onChange={setImageUrl} label="Image" />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Caption (English, optional)</span>
          <input value={captionEn} onChange={(e) => setCaptionEn(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Caption (Bangla, optional)</span>
          <input value={captionBn} onChange={(e) => setCaptionBn(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending || !imageUrl}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/products/marketing-review">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
