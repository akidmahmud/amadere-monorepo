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
  // Same categoryIds shape as CATEGORY_SHOWCASE — only the storefront's
  // rendering differs (150px tile-grid-with-scroll-arrows vs. a plain
  // carousel), so the admin picker is identical.
  if (type === "FEATURED_CATEGORIES") return <CategoryShowcaseFields config={config} onConfigChange={onConfigChange} />;
  if (type === "TOP_SELLING_PRODUCTS") {
    return <TopSellingProductsFields config={config} onConfigChange={onConfigChange} />;
  }
  if (type === "BLOG_TEASER") return <BlogTeaserFields config={config} onConfigChange={onConfigChange} />;
  if (type === "PROMO_VIDEO") return <PromoVideoFields config={config} onConfigChange={onConfigChange} />;
  if (type === "TESTIMONIAL_BENTO") return <TestimonialBentoFields config={config} onConfigChange={onConfigChange} />;
  if (type === "CERTIFICATION_ROW") return <CertificationRowFields config={config} onConfigChange={onConfigChange} />;
  // No longer tabbed — a single-collection product strip now (see
  // TabbedCollectionCarouselSection's own doc comment), so it uses the same
  // plain collection picker as PRODUCT_COLLECTION.
  if (type === "TABBED_COLLECTION_CAROUSEL") {
    return <ProductCollectionFields collectionId={collectionId} onCollectionIdChange={onCollectionIdChange} />;
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

      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Side banner <span className="font-normal text-muted">— shown beside the slider on desktop, stacked below it on mobile; stretches to match the slider's height. Leave empty to hide it.</span>
        </span>
        <div className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
          <MediaPicker
            value={config.stripImageUrl as string | undefined}
            onChange={(url) => onConfigChange({ ...config, stripImageUrl: url })}
            label="Side banner image"
          />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Link URL (optional)</span>
            <input
              value={(config.stripLinkUrl as string | undefined) ?? ""}
              onChange={(e) => onConfigChange({ ...config, stripLinkUrl: e.target.value })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </div>
        </div>
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

interface TopSellingItem {
  productId?: number;
  showBadge?: boolean;
}

// Real products (name/price/image) come from the product itself at render
// time — this only stores which products are in the section, in what order,
// and whether each shows the "Best Selling" badge (per the reference design,
// only some cards do). No new "best seller" flag on Product itself: this
// list is the curation, same convention as CATEGORY_SHOWCASE's categoryIds.
function TopSellingProductsFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const items = (config.items as TopSellingItem[] | undefined) ?? [];
  const { data: products, isLoading } = usePickerProducts();

  function updateItems(next: TopSellingItem[]) {
    onConfigChange({ ...config, items: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-secondary">
        Products <span className="font-normal text-muted">— shown in a 2-column grid; "Best Selling" badge is optional per product</span>
      </span>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-end gap-3 rounded-inner bg-surface-2 p-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Product</span>
              <select
                value={item.productId ?? ""}
                onChange={(e) =>
                  updateItems(items.map((it, j) => (j === i ? { ...it, productId: Number(e.target.value) } : it)))
                }
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="">{isLoading ? "Loading…" : "Select a product"}</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold text-secondary">
              <input
                type="checkbox"
                checked={item.showBadge ?? false}
                onChange={(e) => updateItems(items.map((it, j) => (j === i ? { ...it, showBadge: e.target.checked } : it)))}
              />
              Best Selling badge
            </label>
            <Button type="button" variant="link" className="pb-2.5 text-danger" onClick={() => updateItems(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" className="self-start" onClick={() => updateItems([...items, {}])}>
        Add product
      </Button>
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
              label="Thumbnail (shown until scrolled into view, then autoplays muted)"
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

interface TestimonialReview {
  quote: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  rating?: number;
}

// A horizontal carousel of quote cards (quote, star rating, avatar/name/role)
// — matches ghorerbazar.com's testimonial section. Rating defaults to 5 on
// the storefront if left unset here.
function TestimonialBentoFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const reviews = (config.reviews as TestimonialReview[] | undefined) ?? [];

  function updateReviews(next: TestimonialReview[]) {
    onConfigChange({ ...config, reviews: next });
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">
        Reviews <span className="font-normal text-muted">— shown as a horizontal carousel of quote cards</span>
      </span>
      <div className="flex flex-col gap-3">
        {reviews.map((review, i) => (
          <div key={i} className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
            <MediaPicker
              value={review.avatarUrl}
              onChange={(url) => updateReviews(reviews.map((r, j) => (j === i ? { ...r, avatarUrl: url } : r)))}
              label="Avatar"
            />
            <div className="flex flex-1 flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Quote</span>
                <textarea
                  value={review.quote}
                  onChange={(e) => updateReviews(reviews.map((r, j) => (j === i ? { ...r, quote: e.target.value } : r)))}
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Name</span>
                  <input
                    value={review.name}
                    onChange={(e) => updateReviews(reviews.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Role — e.g. "Student"</span>
                  <input
                    value={review.role ?? ""}
                    onChange={(e) => updateReviews(reviews.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))}
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex w-20 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Rating</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={review.rating ?? 5}
                    onChange={(e) =>
                      updateReviews(reviews.map((r, j) => (j === i ? { ...r, rating: Number(e.target.value) } : r)))
                    }
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="link"
                className="self-start text-danger"
                onClick={() => updateReviews(reviews.filter((_, j) => j !== i))}
              >
                Remove review
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="mt-2"
        onClick={() => updateReviews([...reviews, { quote: "", name: "" }])}
      >
        Add review
      </Button>
    </div>
  );
}

interface CertificationBadge {
  imageUrl?: string;
  label?: string;
}

function CertificationRowFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const items = (config.items as CertificationBadge[] | undefined) ?? [];

  function updateItems(next: CertificationBadge[]) {
    onConfigChange({ ...config, items: next });
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">
        Badges <span className="font-normal text-muted">— small square logos, e.g. certification/award marks</span>
      </span>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
            <MediaPicker
              value={item.imageUrl}
              onChange={(url) => updateItems(items.map((it, j) => (j === i ? { ...it, imageUrl: url } : it)))}
              label={`Badge ${i + 1}`}
            />
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Label (optional — alt text / tooltip)</span>
              <input
                value={item.label ?? ""}
                onChange={(e) => updateItems(items.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)))}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <Button
                type="button"
                variant="link"
                className="self-start text-danger"
                onClick={() => updateItems(items.filter((_, j) => j !== i))}
              >
                Remove badge
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" className="mt-2" onClick={() => updateItems([...items, { imageUrl: "" }])}>
        Add badge
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
