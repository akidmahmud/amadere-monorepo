"use client";

import { useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useGenerateBlogPreviewToken } from "@/hooks/useBlogPosts";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";

interface BlogPreviewButtonProps {
  postId?: number;
  slug?: string;
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export function BlogPreviewButton({ postId, slug }: BlogPreviewButtonProps) {
  const previewToken = useGenerateBlogPreviewToken();
  const storefrontUrl = useStorefrontUrl();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!postId) {
    return (
      <Button type="button" variant="ghost" disabled title="Save the post first — preview needs a real post ID.">
        {eyeIcon}
        Preview
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={previewToken.isPending || !slug}
        onClick={() => {
          previewToken.mutate(postId, {
            onSuccess: ({ token }) => {
              // Uses the saved post's slug, not a possibly-unsaved form
              // field — preview shows what's actually persisted.
              setPreviewUrl(`${storefrontUrl}/blog/${slug}?previewToken=${token}`);
            },
          });
        }}
      >
        {eyeIcon}
        {previewToken.isPending ? "Preparing…" : "Preview"}
      </Button>
      <Modal open={previewUrl !== null} onClose={() => setPreviewUrl(null)} title="Post Preview" className="h-[88vh] max-w-6xl">
        {previewUrl && <iframe src={previewUrl} title="Blog post preview" className="h-full w-full rounded-sm border border-border" />}
      </Modal>
    </>
  );
}
