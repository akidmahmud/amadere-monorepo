"use client";

import { useState } from "react";
import { Button, RatingStars } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { useMyReviews } from "@/hooks/useAccount";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending Approval",
  APPROVED: "Published",
  REJECTED: "Rejected",
};

export function MyReviewsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyReviews(page);

  if (isLoading) return <p className="font-body text-sm text-muted">Loading…</p>;
  if (!data || data.items.length === 0) {
    return <p className="font-body text-sm text-muted">You haven&apos;t written any reviews yet.</p>;
  }

  return (
    <div>
      <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Reviews</h2>
      <div className="space-y-3">
        {data.items.map((review) => (
          <div key={review.id} className="rounded-brand border border-line bg-white p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <AppLink href={`/products/${review.productSlug}`} className="font-ui text-sm font-semibold text-ink">
                {review.productName}
              </AppLink>
              <span className="rounded-full bg-beige px-2.5 py-1 font-ui text-xs font-semibold text-ink">
                {STATUS_LABEL[review.status as unknown as string] ?? (review.status as unknown as string)}
              </span>
            </div>
            <RatingStars rating={review.rating} className="mb-2" />
            {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
            {review.reply && (
              <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                <span className="font-semibold text-ink">Reply: </span>
                {review.reply.message}
              </p>
            )}
          </div>
        ))}
      </div>
      {data.total > data.pageSize && (
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
