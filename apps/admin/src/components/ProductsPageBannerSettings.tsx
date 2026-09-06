"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";

const PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY = "products_page_banner_media_id";
const PRODUCTS_PAGE_BANNER_MOBILE_MEDIA_ID_KEY = "products_page_banner_mobile_media_id";

export function ProductsPageBannerSettings() {
  const { data, isLoading } = useSiteInfo();
  const upsert = useUpsertSetting();

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMobileMediaId, setPendingMobileMediaId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.productsPageBannerUrl) setPreviewUrl(data.productsPageBannerUrl);
  }, [data?.productsPageBannerUrl]);

  useEffect(() => {
    if (data?.productsPageBannerMobileUrl) setMobilePreviewUrl(data.productsPageBannerMobileUrl);
  }, [data?.productsPageBannerMobileUrl]);

  const dirty = pendingMediaId !== null || pendingMobileMediaId !== null;

  async function handleSave() {
    if (pendingMediaId !== null) {
      await upsert.mutateAsync({ key: PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY, value: pendingMediaId });
      setPendingMediaId(null);
    }
    if (pendingMobileMediaId !== null) {
      await upsert.mutateAsync({
        key: PRODUCTS_PAGE_BANNER_MOBILE_MEDIA_ID_KEY,
        value: pendingMobileMediaId,
      });
      setPendingMobileMediaId(null);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
        {/* Said 1180x300 (3.93:1) while the page has rendered 16:5 for a
            while — so it asked for the wrong artwork AND previewed a crop
            that never happened. */}
        <p className="mt-1 text-xs text-muted">
          Shown at the top of the All Products page. Desktop is displayed at
          <strong> 16:5 — upload 1600 × 500px</strong>.
        </p>
      </div>

      <MediaPicker
        label="Desktop banner — 1600 × 500px"
        value={previewUrl}
        onChange={setPreviewUrl}
        onSelectMedia={(media) => setPendingMediaId(media.id)}
      />

      {previewUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Desktop preview (16:5)</span>
          <div className="overflow-hidden rounded-brand border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Products page banner preview"
              // Matches how the storefront actually crops it. The old
              // 1180/300 here showed a crop the page never applied.
              className="aspect-[16/5] w-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted">
          <strong className="text-text">Mobile banner (optional)</strong> — a 16:5 banner is only
          about 105px tall on a phone, so a wide design ends up showing mostly empty background.
          Upload a taller crop (around <strong>800 × 600px</strong>) and phones will use it
          instead. Leave empty to keep using the desktop image everywhere.
        </p>
      </div>

      <MediaPicker
        label="Mobile banner — 800 × 600px"
        value={mobilePreviewUrl}
        onChange={setMobilePreviewUrl}
        onSelectMedia={(media) => setPendingMobileMediaId(media.id)}
      />

      {mobilePreviewUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Mobile preview (4:3)</span>
          <div className="max-w-[320px] overflow-hidden rounded-brand border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mobilePreviewUrl}
              alt="Products page mobile banner preview"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={upsert.isPending || !dirty}
          onClick={handleSave}
        >
          {upsert.isPending ? "Saving…" : "Save Banner"}
        </Button>
        {saved && <span className="text-xs text-success">✓ Saved Banner</span>}
      </div>
    </Card>
  );
}
