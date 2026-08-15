"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";

const SITE_FAVICON_MEDIA_ID_KEY = "site_favicon_media_id";

// Same upload/preview pattern as ProductsPageBannerSettings — its own
// setting key so "which image" stays independently editable via the same
// generic PUT /admin/settings/:key every other setting uses.
export function FaviconSettings() {
  const { data, isLoading } = useSiteInfo();
  const upsert = useUpsertSetting();

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.faviconUrl) {
      setPreviewUrl(data.faviconUrl);
    }
  }, [data?.faviconUrl]);

  async function handleSave() {
    if (pendingMediaId !== null) {
      await upsert.mutateAsync({ key: SITE_FAVICON_MEDIA_ID_KEY, value: pendingMediaId });
      setPendingMediaId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading favicon settings…</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="font-ui text-sm font-semibold text-text">Favicon</h3>
        <p className="mt-1 text-xs text-muted">
          The small icon shown in the browser tab. Square images work best — recommended size: 32x32 or 64x64.
        </p>
      </div>

      <MediaPicker
        label="Favicon Image"
        value={previewUrl}
        onChange={setPreviewUrl}
        onSelectMedia={(media) => setPendingMediaId(media.id)}
      />

      {previewUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Preview</span>
          {/* Mocked browser tab, since a real favicon's only true test is a
              real browser tab — this gets the point across without needing
              an actual second tab to look at. */}
          <div className="flex w-fit items-center gap-1.5 rounded-t-inner border border-b-0 border-border bg-surface-2 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Favicon preview" className="h-4 w-4 shrink-0 object-contain" />
            <span className="max-w-[140px] truncate text-xs text-text">Amader™</span>
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
          {upsert.isPending ? "Saving…" : "Save Favicon"}
        </Button>
        {saved && <span className="text-xs text-success">✓ Saved Favicon</span>}
      </div>
    </Card>
  );
}
