"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { usePickerBlogPosts, usePickerCategories, usePickerCollections, usePickerProducts } from "@/hooks/usePickers";
import type { HomepageSectionType } from "@/hooks/useHomepageSections";

export interface SectionConfigFieldsProps {
  type: HomepageSectionType;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  collectionId: number | undefined;
  onCollectionIdChange: (id: number | undefined) => void;
}

interface Slide {
  imageUrl: string;
  linkUrl?: string;
}

// Real editor forms for the 4 most-used section types (per the confirmed
// design scope); every other type falls back to a plain JSON textarea over
// the same `config` field the backend already expects — functional, not
// polished, upgradeable later without touching the data model.
export function SectionConfigFields({
  type,
  config,
  onConfigChange,
  collectionId,
  onCollectionIdChange,
}: SectionConfigFieldsProps) {
  if (type === "HERO_BANNER") return <HeroBannerFields config={config} onConfigChange={onConfigChange} />;
  if (type === "BANNER_STRIP") return <BannerStripFields config={config} onConfigChange={onConfigChange} />;
  if (type === "PRODUCT_COLLECTION") {
    return <ProductCollectionFields collectionId={collectionId} onCollectionIdChange={onCollectionIdChange} />;
  }
  if (type === "CATEGORY_SHOWCASE") return <CategoryShowcaseFields config={config} onConfigChange={onConfigChange} />;
  if (type === "BLOG_TEASER") return <BlogTeaserFields config={config} onConfigChange={onConfigChange} />;
  if (type === "PROMO_VIDEO") return <PromoVideoFields config={config} onConfigChange={onConfigChange} />;
  if (type === "TABBED_COLLECTION_CAROUSEL") {
    return <TabbedCollectionCarouselFields config={config} onConfigChange={onConfigChange} />;
  }
  if (type === "AD_BANNER") return <AdBannerFields config={config} onConfigChange={onConfigChange} />;
  return <JsonConfigFields config={config} onConfigChange={onConfigChange} />;
}

function HeroBannerFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const slides = (config.slides as Slide[] | undefined) ?? [];

  function updateSlides(next: Slide[]) {
    onConfigChange({ ...config, slides: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Slides <span className="font-normal text-muted">— recommended image size: 1882 × 500px</span>
        </span>
        <div className="flex flex-col gap-4">
          {slides.map((slide, i) => (
            <div key={i} className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
              <MediaPicker
                value={slide.imageUrl}
                onChange={(url) => updateSlides(slides.map((s, j) => (j === i ? { ...s, imageUrl: url } : s)))}
                label={`Slide ${i + 1} image`}
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Link URL (optional)</span>
                <input
                  value={slide.linkUrl ?? ""}
                  onChange={(e) =>
                    updateSlides(slides.map((s, j) => (j === i ? { ...s, linkUrl: e.target.value } : s)))
                  }
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
                <Button
                  type="button"
                  variant="link"
                  className="self-start text-danger"
                  onClick={() => updateSlides(slides.filter((_, j) => j !== i))}
                >
                  Remove slide
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2"
          onClick={() => updateSlides([...slides, { imageUrl: "" }])}
        >
          Add slide
        </Button>
      </div>
    </div>
  );
}

function BannerStripFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <MediaPicker
        value={config.imageUrl as string | undefined}
        onChange={(url) => onConfigChange({ ...config, imageUrl: url })}
        label="Banner image — recommended size: 1690 × 195px"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Link URL (optional — makes the whole banner clickable)</span>
        <input
          value={(config.linkUrl as string | undefined) ?? ""}
          onChange={(e) => onConfigChange({ ...config, linkUrl: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
    </div>
  );
}

// One image = static banner, 2+ = auto-advancing slider (see AdBannerSection
// in @amader/ui) — same Slide shape/editor pattern as Hero Banner.
function AdBannerFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const images = (config.images as Slide[] | undefined) ?? [];

  function updateImages(next: Slide[]) {
    onConfigChange({ ...config, images: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Images <span className="font-normal text-muted">— recommended size: 1686 × 759px. One image shows statically; 2+ auto-advance as a slider.</span>
        </span>
        <div className="flex flex-col gap-4">
          {images.map((image, i) => (
            <div key={i} className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
              <MediaPicker
                value={image.imageUrl}
                onChange={(url) => updateImages(images.map((s, j) => (j === i ? { ...s, imageUrl: url } : s)))}
                label={`Image ${i + 1}`}
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Link URL (optional)</span>
                <input
                  value={image.linkUrl ?? ""}
                  onChange={(e) =>
                    updateImages(images.map((s, j) => (j === i ? { ...s, linkUrl: e.target.value } : s)))
                  }
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
                <Button
                  type="button"
                  variant="link"
                  className="self-start text-danger"
                  onClick={() => updateImages(images.filter((_, j) => j !== i))}
                >
                  Remove image
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2"
          onClick={() => updateImages([...images, { imageUrl: "" }])}
        >
          Add image
        </Button>
      </div>
    </div>
  );
}

const PROMO_VIDEO_SOURCES = ["YOUTUBE", "TIKTOK", "INSTAGRAM", "R2", "GIF"] as const;
type PromoVideoSource = (typeof PROMO_VIDEO_SOURCES)[number];

interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
  productId?: number;
}

// Card size on the storefront is fixed at 377×600 (reel/shorts shape).
// Source determines how the "url" field is captured: R2/GIF are files we
// host (MediaPicker, same widget as everywhere else), YOUTUBE/TIKTOK/
// INSTAGRAM are just a link to the post on that platform.
function PromoVideoFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const videos = (config.videos as PromoVideoCard[] | undefined) ?? [];
  const { data: products } = usePickerProducts();

  function updateVideos(next: PromoVideoCard[]) {
    onConfigChange({ ...config, videos: next });
  }
  function updateCard(i: number, patch: Partial<PromoVideoCard>) {
    updateVideos(videos.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-secondary">
        Videos{" "}
        <span className="font-normal text-muted">
          — cards render at 377 × 600px, autoplay when scrolled into view, click opens a product modal
        </span>
      </span>
      <div className="flex flex-col gap-4">
        {videos.map((card, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-inner bg-surface-2 p-3">
            <div className="flex items-center gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Source</span>
                <select
                  value={card.source}
                  onChange={(e) => updateCard(i, { source: e.target.value as PromoVideoSource, url: "" })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  {PROMO_VIDEO_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="link"
                className="ml-auto self-end text-danger"
                onClick={() => updateVideos(videos.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>

            {card.source === "R2" || card.source === "GIF" ? (
              <MediaPicker
                value={card.url}
                onChange={(url) => updateCard(i, { url })}
                label={card.source === "GIF" ? "GIF file" : "Video file"}
              />
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">{card.source} URL</span>
                <input
                  value={card.url}
                  onChange={(e) => updateCard(i, { url: e.target.value })}
                  placeholder={
                    card.source === "YOUTUBE"
                      ? "https://youtube.com/watch?v=..."
                      : card.source === "TIKTOK"
                        ? "https://tiktok.com/@user/video/..."
                        : "https://instagram.com/reel/..."
                  }
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            )}

            <MediaPicker
              value={card.thumbnailUrl}
              onChange={(url) => updateCard(i, { thumbnailUrl: url })}
              label="Thumbnail (shown before hover)"
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Linked product (optional)</span>
              <select
                value={card.productId ?? ""}
                onChange={(e) =>
                  updateCard(i, { productId: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="">— None —</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        onClick={() => updateVideos([...videos, { source: "YOUTUBE", url: "" }])}
      >
        Add video
      </Button>
    </div>
  );
}

interface LocalizedText {
  EN: string;
  BN: string;
}
const EMPTY_TEXT: LocalizedText = { EN: "", BN: "" };

interface TabConfig {
  collectionId?: number;
  tabLabel?: LocalizedText;
  promoImageUrl?: string;
  promoHeading?: LocalizedText;
  promoBlurb?: LocalizedText;
  viewAllUrl?: string;
}

function LocalizedInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: LocalizedText | undefined;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
}) {
  const v = value ?? EMPTY_TEXT;
  const Field = multiline ? "textarea" : "input";
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["EN", "BN"] as const).map((locale) => (
        <label key={locale} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            {label} ({locale})
          </span>
          <Field
            value={v[locale]}
            onChange={(e) => onChange({ ...v, [locale]: e.target.value })}
            rows={multiline ? 2 : undefined}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      ))}
    </div>
  );
}

// Tabs reference real Collections by id — no new product-grouping model,
// per the feature spec. Translatable per-tab text is stored inline in the
// JSON config as {EN, BN} rather than via the section-level translations
// table, since that table only holds one heading/subheading per section,
// not per-tab — same "config is freeform JSON" convention every other
// section type already uses, just with the locale split kept inside it.
function TabbedCollectionCarouselFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const { data: collections, isLoading } = usePickerCollections();
  const tabs = (config.tabs as TabConfig[] | undefined) ?? [];
  const productsPerTab = (config.productsPerTab as number | undefined) ?? 10;
  const defaultActiveTab = (config.defaultActiveTab as number | undefined) ?? 0;

  function updateTabs(next: TabConfig[]) {
    onConfigChange({ ...config, tabs: next });
  }
  function updateTab(i: number, patch: Partial<TabConfig>) {
    updateTabs(tabs.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Products per tab</span>
          <input
            type="number"
            min={1}
            value={productsPerTab}
            onChange={(e) => onConfigChange({ ...config, productsPerTab: Number(e.target.value) })}
            className="num h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Default active tab (index)</span>
          <input
            type="number"
            min={0}
            max={Math.max(0, tabs.length - 1)}
            value={defaultActiveTab}
            onChange={(e) => onConfigChange({ ...config, defaultActiveTab: Number(e.target.value) })}
            className="num h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>

      <span className="text-xs font-semibold text-secondary">Tabs (each maps to one Collection)</span>
      <div className="flex flex-col gap-4">
        {tabs.map((tab, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-inner bg-surface-2 p-3">
            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Collection</span>
                <select
                  value={tab.collectionId ?? ""}
                  onChange={(e) => updateTab(i, { collectionId: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="">{isLoading ? "Loading…" : "Select a collection"}</option>
                  {collections?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="link" className="text-danger" onClick={() => updateTabs(tabs.filter((_, j) => j !== i))}>
                Remove tab
              </Button>
            </div>

            <LocalizedInput label="Tab label" value={tab.tabLabel} onChange={(v) => updateTab(i, { tabLabel: v })} />

            <MediaPicker
              value={tab.promoImageUrl}
              onChange={(url) => updateTab(i, { promoImageUrl: url })}
              label="Promo tile image — recommended size: 392 × 660px (falls back to collection image if empty)"
            />

            <LocalizedInput label="Promo heading" value={tab.promoHeading} onChange={(v) => updateTab(i, { promoHeading: v })} />
            <LocalizedInput
              label="Promo blurb"
              value={tab.promoBlurb}
              onChange={(v) => updateTab(i, { promoBlurb: v })}
              multiline
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">
                View All URL (optional — defaults to the collection's page)
              </span>
              <input
                value={tab.viewAllUrl ?? ""}
                onChange={(e) => updateTab(i, { viewAllUrl: e.target.value })}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" className="self-start" onClick={() => updateTabs([...tabs, {}])}>
        Add tab
      </Button>
    </div>
  );
}

function ProductCollectionFields({
  collectionId,
  onCollectionIdChange,
}: {
  collectionId: number | undefined;
  onCollectionIdChange: (id: number | undefined) => void;
}) {
  const { data: collections, isLoading } = usePickerCollections();

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">Collection</span>
      <select
        value={collectionId ?? ""}
        onChange={(e) => onCollectionIdChange(e.target.value ? Number(e.target.value) : undefined)}
        className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
      >
        <option value="">{isLoading ? "Loading…" : "Select a collection"}</option>
        {collections?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategoryShowcaseFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const { data: categories, isLoading } = usePickerCategories();
  const selected = new Set((config.categoryIds as number[] | undefined) ?? []);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onConfigChange({ ...config, categoryIds: Array.from(next) });
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">
        Categories (none selected = show all)
      </span>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text"
          >
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function BlogTeaserFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const { data: posts, isLoading } = usePickerBlogPosts();
  const selected = new Set((config.postIds as number[] | undefined) ?? []);
  const limit = (config.limit as number | undefined) ?? 5;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onConfigChange({ ...config, postIds: Array.from(next) });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Limit (if no posts selected below)</span>
        <input
          type="number"
          min={1}
          value={limit}
          onChange={(e) => onConfigChange({ ...config, limit: Number(e.target.value) })}
          className="num h-10 w-24 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Posts (none selected = most recent, up to limit)
        </span>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        <div className="flex flex-col gap-1.5">
          {posts?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function JsonConfigFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    try {
      onConfigChange(text.trim() ? JSON.parse(text) : {});
      setError(null);
    } catch {
      setError("Invalid JSON — changes not applied until this is fixed.");
    }
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">
        Config (JSON) — no dedicated form for this type yet
      </span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={10}
        className="num rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
