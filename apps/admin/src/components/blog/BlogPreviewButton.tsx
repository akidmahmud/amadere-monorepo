"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
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

// Opens the preview in a new tab, exactly like ProductPreviewButton. It used
// to render the storefront in an <iframe> modal, which production can never
// show: amadere.com is served with `X-Frame-Options: SAMEORIGIN` (set at the
// server/CDN, not in this repo), so a frame on admin.amadere.com — a different
// origin — stays blank. It only ever worked on localhost, where that header
// isn't sent. A tab has no framing rules to fall foul of.
export function BlogPreviewButton({ postId, slug }: BlogPreviewButtonProps) {
  const previewToken = useGenerateBlogPreviewToken();
  const storefrontUrl = useStorefrontUrl();
  // Only set when the browser blocked the popup — then we show a link the
  // admin can click themselves rather than silently doing nothing.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  if (!postId) {
    return (
      <Button type="button" variant="ghost" disabled title="Save the post first — preview needs a real post ID.">
        {eyeIcon}
        Preview
      </Button>
    );
  }

  function openPreview() {
    setBlockedUrl(null);

    // Opened SYNCHRONOUSLY, inside the click, before the async token call:
    // browsers only allow window.open during a user gesture, so opening it
    // from the mutation callback would be blocked as a popup.
    const tab = window.open("", "_blank");
    if (tab) tab.document.write("Preparing preview…");

    previewToken.mutate(postId!, {
      onSuccess: ({ token }) => {
        // The saved slug, not a possibly-unsaved form field — preview shows
        // what's persisted. The `/en` prefix is load-bearing: the token is a
        // JWT (it contains dots) and apps/web's proxy matcher skips any path
        // with a dot, so the locale rewrite never runs on a preview URL.
        const url = `${storefrontUrl}/en/blog/${slug}/preview/${token}`;
        if (tab && !tab.closed) {
          tab.location.replace(url);
        } else {
          setBlockedUrl(url);
        }
      },
      onError: () => tab?.close(),
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" disabled={previewToken.isPending || !slug} onClick={openPreview}>
        {eyeIcon}
        {previewToken.isPending ? "Preparing…" : "Preview"}
      </Button>
      {blockedUrl && (
        <a href={blockedUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" onClick={() => setBlockedUrl(null)}>
          Popup blocked — open preview
        </a>
      )}
    </>
  );
}
