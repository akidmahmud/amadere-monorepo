"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import { useGenerateProductPreviewToken } from "@/hooks/useProducts";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";

interface ProductPreviewButtonProps {
  productId?: number;
  slug?: string;
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export function ProductPreviewButton({ productId, slug }: ProductPreviewButtonProps) {
  const previewToken = useGenerateProductPreviewToken();
  const storefrontUrl = useStorefrontUrl();
  // Only set when the browser blocked the popup — then we show a link the
  // admin can click themselves rather than silently doing nothing.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  if (!productId) {
    return (
      <Button type="button" variant="ghost" disabled title="Save the product first — preview needs a real product ID.">
        {eyeIcon}
        Preview
      </Button>
    );
  }

  function openPreview() {
    setBlockedUrl(null);

    // Opened SYNCHRONOUSLY, inside the click, before the async token call.
    // Browsers only allow window.open during a user gesture, so opening it
    // from the mutation callback instead would be blocked as a popup — which
    // is why this holds a blank tab and fills in the URL once the token
    // arrives.
    const tab = window.open("", "_blank");
    if (tab) tab.document.write("Preparing preview…");

    previewToken.mutate(productId!, {
      onSuccess: ({ token }) => {
        // Uses the saved product's slug, not a possibly-unsaved form
        // field — preview shows what's actually persisted. Path-based
        // token (not `?previewToken=`) so the real product route never
        // has to read searchParams and can stay statically cached —
        // see PERF-BRIEF.md §3 / product-detail.tsx.
        const url = `${storefrontUrl}/en/products/${slug}/preview/${token}`;
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
      <Button
        type="button"
        variant="ghost"
        disabled={previewToken.isPending || !slug}
        onClick={openPreview}
      >
        {eyeIcon}
        {previewToken.isPending ? "Preparing…" : "Preview"}
      </Button>
      {blockedUrl && (
        <a
          href={blockedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold underline"
          onClick={() => setBlockedUrl(null)}
        >
          Popup blocked — open preview
        </a>
      )}
    </>
  );
}
