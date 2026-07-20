"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteMarketingReviewCard, useMarketingReviewCards } from "@/hooks/useMarketingReviewCards";

export default function MarketingReviewCardsPage() {
  const { data: items, isLoading } = useMarketingReviewCards();
  const deleteItem = useDeleteMarketingReviewCard();

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Marketing Review Cards</p>
          <p className="text-xs text-muted">Same cards shown on every product page, below the purchase panel.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/products">
            <Button type="button" variant="ghost">Back to Products</Button>
          </Link>
          <Link href="/products/marketing-review/new">
            <Button variant="primary">Add card</Button>
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted">No marketing review cards yet.</p>}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-inner border border-border object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {item.translations[0]?.caption || "(no caption)"}
              </div>
              <div className="text-xs text-muted">{item.isActive ? "active" : "inactive"}</div>
            </div>
            <Link href={`/products/marketing-review/${item.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm("Delete this card?")) deleteItem.mutate(item.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
