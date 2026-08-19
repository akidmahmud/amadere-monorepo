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
              // field — preview shows what's actually persisted. Path-based
              // token (not `?previewToken=`) so the real post route never
              // has to read searchParams and can stay statically cached —
              // see PERF-BRIEF.md §3 / post-detail.tsx.
              //
              // The `/en` prefix is load-bearing, NOT cosmetic — it's why
              // ProductPreviewButton always worked and this one always
              // 404'd. The token is a JWT, so it contains dots, and
              // apps/web's proxy.ts matcher excludes every path containing
              // one (`.*\..*`, there to skip static files). next-intl's
              // locale proxy therefore never runs on a preview URL and
              // never rewrites `/blog/...` to `/en/blog/...`, leaving a
              // 4-segment path that can't match [locale]/blog/[slug]/
              // preview/[token]. Sending the locale explicitly means the
              // route resolves without needing the rewrite at all.
              setPreviewUrl(`${storefrontUrl}/en/blog/${slug}/preview/${token}`);
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
