"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { REVIEW_STATUSES, useReplyToReview, useReviews, useUpdateReviewStatus, type ReviewStatus } from "@/hooks/useReviews";

function ReplyBox({ reviewId, existing }: { reviewId: number; existing: string | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(existing ?? "");
  const reply = useReplyToReview();

  if (existing && !open) {
    return (
      <div className="mt-2 rounded-inner bg-surface-2 p-2.5 text-sm text-text">
        <span className="text-xs font-semibold text-secondary">Reply: </span>
        {existing}{" "}
        <Button type="button" variant="link" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="link" className="mt-2 self-start" onClick={() => setOpen(true)}>
        Reply
      </Button>
    );
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="flex-1 rounded-sm border border-border bg-surface p-2 text-sm text-text outline-none focus:border-brand-500"
      />
      <Button
        type="button"
        variant="ghost"
        disabled={reply.isPending || !message.trim()}
        onClick={() => reply.mutate({ id: reviewId, message }, { onSuccess: () => setOpen(false) })}
      >
        {reply.isPending ? "Saving…" : "Save reply"}
      </Button>
    </div>
  );
}

export default function ReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus | undefined>();
  const { data: reviews, isLoading } = useReviews(status);
  const updateStatus = useUpdateReviewStatus();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{reviews?.length ?? 0} reviews</p>
        <select
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value ? (e.target.value as ReviewStatus) : undefined)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {reviews && reviews.length === 0 && <p className="text-sm text-muted">No reviews.</p>}

      <div className="flex flex-col gap-3">
        {reviews?.map((review) => (
          <Card key={review.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-text">
                  {review.productName} — {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </div>
                <div className="text-xs text-muted">
                  {review.customerName} · {new Date(review.createdAt).toLocaleDateString()} · {review.status}
                </div>
              </div>
              <div className="flex gap-2">
                {review.status !== "APPROVED" && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: review.id, status: "APPROVED" })}
                  >
                    Approve
                  </Button>
                )}
                {review.status !== "REJECTED" && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: review.id, status: "REJECTED" })}
                  >
                    Reject
                  </Button>
                )}
              </div>
            </div>
            {review.comment && <p className="text-sm text-text">{review.comment}</p>}
            <ReplyBox reviewId={review.id} existing={review.reply?.message ?? null} />
          </Card>
        ))}
      </div>
    </>
  );
}
