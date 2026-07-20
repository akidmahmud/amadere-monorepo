"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useCreateMarketingReviewCard } from "@/hooks/useMarketingReviewCards";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewMarketingReviewCardPage() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [captionEn, setCaptionEn] = useState("");
  const [captionBn, setCaptionBn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const create = useCreateMarketingReviewCard();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) return;
    await create.mutateAsync({
      imageUrl,
      sortOrder: 0,
      isActive,
      translations: [
        { locale: "EN", caption: captionEn || undefined },
        { locale: "BN", caption: captionBn || undefined },
      ],
    });
    router.push("/products/marketing-review");
  }

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
          <Button type="submit" variant="primary" disabled={create.isPending || !imageUrl}>
            {create.isPending ? "Saving…" : "Create card"}
          </Button>
          <Link href="/products/marketing-review">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
