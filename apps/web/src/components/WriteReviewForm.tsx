"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@amader/ui";
import { useMe } from "@/hooks/useAuth";
import { useCreateReview, useUploadReviewImage } from "@/hooks/useAccount";
import { AppLink } from "@/components/AppLink";

const MAX_IMAGES = 5;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill={n <= value ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={n <= value ? 0 : 1.5}
            className={n <= value ? "text-gold" : "text-line"}
          >
            <path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// Verified-purchase gate is enforced backend-side (ForbiddenException if no
// completed order for this product) — the form is shown to any logged-in
// customer, and a non-purchaser just sees that message on submit, rather
// than this component needing its own "did they buy it" pre-check endpoint.
export function WriteReviewForm({ productId }: { productId: number }) {
  const { data: me, isLoading: meLoading } = useMe();
  const createReview = useCreateReview();
  const uploadImage = useUploadReviewImage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // `useMe()` can resolve from an already-warm client cache (e.g. the
  // header fetched it first) before hydration finishes, while the server
  // render always sees the loading state — that mismatch between "server
  // rendered null" and "client's first paint already had the real content"
  // is a real hydration error, not just a lint nit. Waiting for mount
  // guarantees the client's first paint matches the server's exactly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || meLoading) return null;

  if (!me) {
    return (
      <p className="mx-auto max-w-2xl font-body text-sm text-muted">
        <AppLink href="/login" className="text-green underline">
          Log in
        </AppLink>{" "}
        to write a review — only customers who&apos;ve purchased this product can.
      </p>
    );
  }

  if (submitted || createReview.isSuccess) {
    return (
      <div className="mx-auto max-w-2xl rounded-brand border border-line bg-white p-5 text-center">
        <p className="font-ui text-sm font-semibold text-green">Thanks for your review!</p>
        <p className="mt-1 font-body text-xs text-muted">It&apos;ll appear here once our team approves it.</p>
      </div>
    );
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
      uploadImage.mutate(file, { onSuccess: (r) => setImages((prev) => [...prev, r.url]) });
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-brand border border-line bg-white p-5">
      <h3 className="mb-3 font-ui text-sm font-semibold text-ink">Write a Review</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createReview.mutate(
            { productId, rating, comment: comment.trim() || undefined, images },
            { onSuccess: () => setSubmitted(true) },
          );
        }}
        className="flex flex-col gap-3"
      >
        <StarPicker value={rating} onChange={setRating} />

        <textarea
          rows={3}
          placeholder="Share your experience with this product (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm outline-none focus:border-green"
        />

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative h-14 w-14 overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                disabled={uploadImage.isPending}
              >
                {uploadImage.isPending ? "Uploading…" : "Add photos"}
              </Button>
            )}
          </div>
        </div>

        {createReview.isError && (
          <p className="font-body text-xs text-red-600">
            {createReview.error instanceof Error ? createReview.error.message : "Couldn't submit your review"}
          </p>
        )}

        <Button type="submit" variant="green" disabled={rating < 1 || createReview.isPending} className="self-start">
          {createReview.isPending ? "Submitting…" : "Submit Review"}
        </Button>
      </form>
    </div>
  );
}
