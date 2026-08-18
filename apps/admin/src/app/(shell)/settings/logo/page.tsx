"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";
import { ProductsPageBannerSettings } from "@/components/ProductsPageBannerSettings";

const logoIcon = <Icon name="image" />;
const numberInputClass = "h-10 w-28 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function LogoSettingsPage() {
  const { data, isLoading } = useSiteInfo();
  const upsert = useUpsertSetting();

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [paddingPx, setPaddingPx] = useState(0);
  const [marginPx, setMarginPx] = useState(0);
  const [saved, setSaved] = useState(false);

  // Seeds the draft from the real current values once they load — same
  // "draft state initialized from server data" pattern as the invoice
  // settings page, so typing here doesn't fight a refetch mid-edit.
  useEffect(() => {
    if (!data) return;
    setPreviewUrl(data.logoUrl ?? undefined);
    setPaddingPx(data.logoPaddingPx);
    setMarginPx(data.logoMarginPx);
  }, [data]);

  function handleSave() {
    const writes: Promise<unknown>[] = [
      upsert.mutateAsync({ key: "site_logo_style", value: { paddingPx, marginPx } }),
    ];
    if (pendingMediaId !== null) {
      writes.push(upsert.mutateAsync({ key: "site_logo_media_id", value: pendingMediaId }));
    }
    Promise.all(writes).then(() => {
      setPendingMediaId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          icon={logoIcon}
          title="Logo"
          subtitle="The mark shown in the storefront header and mobile menu."
          style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={logoIcon}
        title="Logo"
        subtitle="The mark shown in the storefront header and mobile menu."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Card className="flex flex-col gap-4">
        <MediaPicker
          label="Logo image"
          value={previewUrl}
          onChange={setPreviewUrl}
          onSelectMedia={(media) => setPendingMediaId(media.id)}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Padding (px)</span>
            <input
              type="number"
              min={0}
              value={paddingPx}
              onChange={(e) => setPaddingPx(Math.max(0, Number(e.target.value) || 0))}
              className={numberInputClass}
            />
            <span className="text-xs text-muted">Shrinks the logo inward within its header slot.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Margin (px)</span>
            <input
              type="number"
              min={0}
              value={marginPx}
              onChange={(e) => setMarginPx(Math.max(0, Number(e.target.value) || 0))}
              className={numberInputClass}
            />
            <span className="text-xs text-muted">Adds space around the logo, away from nearby header items.</span>
          </label>
        </div>

        {/* Rough live preview — the real header sizes the logo to its own
            fixed slot (h-[120px] desktop / h-[88px] mobile in Header.tsx),
            which this can't reproduce exactly, but the padding/margin ratio
            relative to a representative box is the part that actually
            needs previewing. */}
        {previewUrl && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Preview (approximate)</span>
            <div className="flex h-[136px] w-fit items-center rounded-inner border border-dashed border-border bg-surface-2 px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Logo preview"
                className="h-[120px] w-auto"
                style={{ padding: paddingPx, margin: marginPx, boxSizing: "border-box" }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" className="self-start" disabled={upsert.isPending} onClick={handleSave}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-xs text-success">✓ Saved</span>}
        </div>
      </Card>

      <ProductsPageBannerSettings />
    </div>
  );
}
