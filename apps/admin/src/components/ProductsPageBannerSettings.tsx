"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";

const PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY = "products_page_banner_media_id";

export function ProductsPageBannerSettings() {
  const { data, isLoading } = useSiteInfo();
  const upsert = useUpsertSetting();

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.productsPageBannerUrl) {
      setPreviewUrl(data.productsPageBannerUrl);
    }
  }, [data?.productsPageBannerUrl]);

  async function handleSave() {
    if (pendingMediaId !== null) {
      await upsert.mutateAsync({ key: PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY, value: pendingMediaId });
      setPendingMediaId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading banner settings…</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="font-ui text-sm font-semibold text-text">All Products Page Banner</h3>
        <p className="mt-1 text-xs text-muted">
          Upload or select the banner image shown at the top of the All Products page (http://localhost:3001/products). Recommended ratio: 1180x300.
        </p>
      </div>

      <MediaPicker
        label="Products Page Banner Image"
        value={previewUrl}
        onChange={setPreviewUrl}
        onSelectMedia={(media) => setPendingMediaId(media.id)}
      />

      {previewUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Banner Preview</span>
          <div className="overflow-hidden rounded-brand border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Products page banner preview"
              className="aspect-[1180/300] w-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={upsert.isPending || pendingMediaId === null}
          onClick={handleSave}
        >
          {upsert.isPending ? "Saving…" : "Save Banner"}
        </Button>
        {saved && <span className="text-xs text-success">✓ Saved Banner</span>}
      </div>
    </Card>
  );
}
