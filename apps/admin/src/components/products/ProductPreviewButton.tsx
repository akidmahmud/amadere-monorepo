"use client";

import { useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useGenerateProductPreviewToken } from "@/hooks/useProducts";

interface ProductPreviewButtonProps {
  productId?: number;
  slug?: string;
}

export function ProductPreviewButton({ productId, slug }: ProductPreviewButtonProps) {
  const previewToken = useGenerateProductPreviewToken();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!productId) {
    return (
      <Button type="button" variant="ghost" disabled title="Save the product first — preview needs a real product ID.">
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
          previewToken.mutate(productId, {
            onSuccess: ({ token }) => {
              const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001";
              // Uses the saved product's slug, not a possibly-unsaved form
              // field — preview shows what's actually persisted.
              setPreviewUrl(`${storefrontUrl}/en/products/${slug}?previewToken=${token}`);
            },
          });
        }}
      >
        {previewToken.isPending ? "Preparing…" : "Preview"}
      </Button>
      <Modal
        open={previewUrl !== null}
        onClose={() => setPreviewUrl(null)}
        title="Product Preview"
        className="h-[88vh] max-w-6xl"
      >
        {previewUrl && <iframe src={previewUrl} title="Product preview" className="h-full w-full rounded-sm border border-border" />}
      </Modal>
    </>
  );
}
