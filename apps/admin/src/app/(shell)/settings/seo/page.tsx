"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { FaviconSettings } from "@/components/FaviconSettings";
import { OgPreviewCard } from "@/components/OgPreviewCard";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";

const seoIcon = <Icon name="travel_explore" />;

const SITE_SEO_TITLE_KEY = "site_seo_title";
const SITE_SEO_DESCRIPTION_KEY = "site_seo_description";
const SITE_SEO_IMAGE_MEDIA_ID_KEY = "site_seo_image_media_id";

export default function SeoSettingsPage() {
  const { data, isLoading } = useSiteInfo();
  const upsert = useUpsertSetting();
  const storefrontUrl = useStorefrontUrl();
  const domain = (() => {
    try {
      return new URL(storefrontUrl).hostname;
    } catch {
      return storefrontUrl;
    }
  })();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.seoTitle ?? "");
    setDescription(data.seoDescription ?? "");
    setPreviewUrl(data.seoImageUrl ?? undefined);
  }, [data]);

  function handleSave() {
    const writes: Promise<unknown>[] = [
      upsert.mutateAsync({ key: SITE_SEO_TITLE_KEY, value: title }),
      upsert.mutateAsync({ key: SITE_SEO_DESCRIPTION_KEY, value: description }),
    ];
    if (pendingMediaId !== null) {
      writes.push(upsert.mutateAsync({ key: SITE_SEO_IMAGE_MEDIA_ID_KEY, value: pendingMediaId }));
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
          icon={seoIcon}
          title="Site SEO Settings"
          subtitle="Site-wide title, description, and preview image for search engines and shared links."
          style={{ background: "linear-gradient(135deg, #0A1F14 0%, #21713d 100%)" }}
        />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={seoIcon}
        title="Site SEO Settings"
        subtitle="Site-wide title, description, and preview image for search engines and shared links."
        style={{ background: "linear-gradient(135deg, #0A1F14 0%, #21713d 100%)" }}
      />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="font-ui text-sm font-semibold text-text">Homepage &amp; site defaults</h3>
          <p className="mt-1 text-xs text-muted">
            Used for the homepage and any other page without its own SEO Meta override (see the separate{" "}
            <Link href="/seo-meta" className="text-brand-500 underline">SEO Meta</Link> section for per-product/
            per-page control). This also controls what shows up when someone shares your site&apos;s link on
            WhatsApp, Messenger, Facebook, or Discord.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Site title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Amader™ — Organic & Natural Products"
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <span className="text-xs text-muted">{title.length}/200 characters — shown as the bold headline in link previews.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Site description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A short line describing your site — shown under the title in link previews and search results."
            className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <span className="text-xs text-muted">{description.length}/500 characters.</span>
        </label>

        <MediaPicker
          label="Preview image (Open Graph)"
          value={previewUrl}
          onChange={setPreviewUrl}
          onSelectMedia={(media) => setPendingMediaId(media.id)}
        />
        <span className="-mt-2.5 text-xs text-muted">
          Recommended size 1200×630px. This is the big image shown when your site link is shared.
        </span>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link preview (approximate)</span>
          <OgPreviewCard imageUrl={previewUrl} title={title} description={description} domain={domain} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" className="self-start" disabled={upsert.isPending} onClick={handleSave}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-xs text-success">✓ Saved</span>}
        </div>
      </Card>

      <FaviconSettings />
    </div>
  );
}
