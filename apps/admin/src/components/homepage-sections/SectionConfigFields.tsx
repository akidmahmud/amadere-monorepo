"use client";

import { useRef, useState } from "react";
import { Button, Icon, Modal } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";
import { useUploadMedia } from "@/hooks/useMedia";
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

interface HomeBannerTwoSlide extends Slide {
  mobileImageUrl?: string;
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
  // JUST_FOR_YOU and FEATURED_DEALS store the exact same
  // `{productId, showBadge}[]` shape as TOP_SELLING_PRODUCTS — only the
  // storefront's rendering differs (compact strip / gradient promo card vs.
  // big-card grid) — so they all reuse the same picker.
  if (type === "TOP_SELLING_PRODUCTS" || type === "JUST_FOR_YOU" || type === "FEATURED_DEALS") {
    return <TopSellingProductsFields config={config} onConfigChange={onConfigChange} />;
  }
  if (type === "BLOG_TEASER") return <BlogTeaserFields config={config} onConfigChange={onConfigChange} />;
  if (type === "TESTIMONIAL_BENTO") return <TestimonialBentoFields config={config} onConfigChange={onConfigChange} />;
  if (type === "CERTIFICATION_ROW") return <CertificationRowFields config={config} onConfigChange={onConfigChange} />;
  // No longer tabbed — a single-collection product strip now (see
  // TabbedCollectionCarouselSection's own doc comment), so it uses the same
  // plain collection picker as PRODUCT_COLLECTION.
  if (type === "TABBED_COLLECTION_CAROUSEL") {
    return <ProductCollectionFields collectionId={collectionId} onCollectionIdChange={onCollectionIdChange} />;
  }
  if (type === "AD_BANNER") return <AdBannerFields config={config} onConfigChange={onConfigChange} />;
  if (type === "HOME_BANNER_TWO") return <HomeBannerTwoFields config={config} onConfigChange={onConfigChange} />;
  if (type === "NEWSLETTER") return <NewsletterFields config={config} onConfigChange={onConfigChange} />;
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

  // Sections saved before "multiple side banners" only have the old singular
  // stripImageUrl/stripLinkUrl fields — read those as a one-item list so an
  // existing side banner doesn't silently disappear from this form. Any edit
  // here (add/remove/change) writes the new sideBanners array going forward;
  // the old fields are left alone in the config object (harmless, unused
  // once sideBanners exists — the storefront prefers sideBanners too).
  const sideBanners =
    (config.sideBanners as Slide[] | undefined) ??
    (config.stripImageUrl ? [{ imageUrl: config.stripImageUrl as string, linkUrl: config.stripLinkUrl as string | undefined }] : []);

  function updateSideBanners(next: Slide[]) {
    onConfigChange({ ...config, sideBanners: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Slides <span className="font-normal text-muted">— recommended image size: 1600 × 500px</span>
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
          Side banners{" "}
          <span className="font-normal text-muted">
            — shown beside the slider on desktop only (hidden on mobile, not just stacked), sized to match the
            slider's height. 2+ images auto-rotate (no arrows — this slot stays quiet next to the main slider's own
            controls). Leave empty to hide the slot entirely.
          </span>
        </span>
        <div className="flex flex-col gap-4">
          {sideBanners.map((banner, i) => (
            <div key={i} className="flex items-start gap-3 rounded-inner bg-surface-2 p-3">
              <MediaPicker
                value={banner.imageUrl}
                onChange={(url) => updateSideBanners(sideBanners.map((b, j) => (j === i ? { ...b, imageUrl: url } : b)))}
                label={`Side banner ${i + 1} image`}
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Link URL (optional)</span>
                <input
                  value={banner.linkUrl ?? ""}
                  onChange={(e) =>
                    updateSideBanners(sideBanners.map((b, j) => (j === i ? { ...b, linkUrl: e.target.value } : b)))
                  }
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
                <Button
                  type="button"
                  variant="link"
                  className="self-start text-danger"
                  onClick={() => updateSideBanners(sideBanners.filter((_, j) => j !== i))}
                >
                  Remove side banner
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2"
          onClick={() => updateSideBanners([...sideBanners, { imageUrl: "" }])}
        >
          Add side banner
        </Button>
      </div>
    </div>
  );
}

// A slot that's either "has an image" (thumbnail + a single destructive
// Remove) or "empty" (Upload + Browse library, stacked) — never both at
// once, matching the redesigned Slides card (image picking and image
// removal read as two different actions, not one combined widget).
function ImageSlot({
  value,
  onChange,
  aspectClassName = "aspect-[1690/575]",
}: {
  value: string | undefined;
  onChange: (url: string) => void;
  aspectClassName?: string;
}) {
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    onChange(media.url);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className={`w-full ${aspectClassName} rounded-inner border border-border object-cover`} />
        <button
          type="button"
          onClick={() => onChange("")}
          className="inline-flex items-center gap-1 self-start rounded-sm border border-danger/30 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5"
        >
          <Icon name="delete" size={15} /> Remove image
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={upload.isPending}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-brand-500 px-3 py-2 text-xs font-semibold text-brand-500 hover:bg-brand-50 disabled:opacity-50"
      >
        <Icon name="upload" size={15} /> {upload.isPending ? "Uploading…" : "Upload image"}
      </button>
      <button
        type="button"
        onClick={() => setShowLibrary(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-brand-500 px-3 py-2 text-xs font-semibold text-brand-500 hover:bg-brand-50"
      >
        <Icon name="folder" size={15} /> Browse library
      </button>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library" className="max-w-5xl">
        <MediaLibraryBrowser
          onSelect={(media) => {
            onChange(media.url);
            setShowLibrary(false);
          }}
        />
      </Modal>
    </div>
  );
}

// Full-bleed promo carousel (no side-banner slot, unlike Hero Banner) — each
// slide is one flat promo image (like organicindia.com's hero) with an
// optional separate mobile crop, since a wide desktop banner rarely reads
// well shrunk to a phone width as-is.
function HomeBannerTwoFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const slides = (config.slides as HomeBannerTwoSlide[] | undefined) ?? [];

  function updateSlides(next: HomeBannerTwoSlide[]) {
    onConfigChange({ ...config, slides: next });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
            <Icon name="image" size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-text">Slides</div>
            <div className="text-xs text-muted">Recommended image size: 1690 × 575px (desktop)</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateSlides([...slides, { imageUrl: "" }])}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-brand-500 px-3 text-xs font-bold text-brand-500 hover:bg-brand-50"
        >
          <Icon name="add" size={16} /> Add slide
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {slides.map((slide, i) => (
          <div key={i} className="flex gap-4 rounded-inner border border-border p-4">
            <div className="flex flex-none flex-col items-center gap-2 pt-1">
              <Icon name="drag_indicator" size={18} className="cursor-grab text-muted" />
              <span className="grid h-7 w-9 place-items-center rounded-sm bg-brand-50 text-xs font-bold text-brand-500">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-text">Desktop image (1690×575px)</span>
                <div className="w-[170px]">
                  <ImageSlot
                    value={slide.imageUrl}
                    onChange={(url) => updateSlides(slides.map((s, j) => (j === i ? { ...s, imageUrl: url } : s)))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-text">Mobile image (optional)</span>
                <span className="-mt-1 text-[0.7rem] leading-snug text-muted">
                  800×450px — skipping this crops the desktop image on mobile
                </span>
                <div className="w-[170px]">
                  <ImageSlot
                    value={slide.mobileImageUrl}
                    onChange={(url) => updateSlides(slides.map((s, j) => (j === i ? { ...s, mobileImageUrl: url } : s)))}
                    aspectClassName="aspect-[800/450]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-text">Link URL (optional)</span>
                <div className="relative">
                  <Icon name="public" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={slide.linkUrl ?? ""}
                    onChange={(e) => updateSlides(slides.map((s, j) => (j === i ? { ...s, linkUrl: e.target.value } : s)))}
                    placeholder="https://example.com"
                    className="h-10 w-full rounded-sm border border-border bg-surface pl-8 pr-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateSlides(slides.filter((_, j) => j !== i))}
                  className="inline-flex items-center gap-1 self-start text-xs font-semibold text-danger hover:underline"
                >
                  <Icon name="delete" size={15} /> Remove slide
                </button>
              </div>
            </div>
          </div>
        ))}
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
          Images <span className="font-normal text-muted">— recommended size: 1600 × 500px. One image shows statically; 2+ auto-advance as a slider.</span>
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

// Email-capture strip with the signup form laid over the artwork.
//
// Two images, not one: the desktop banner is 3.2:1, which on a phone is only
// ~120px tall — far too short to put an email field and a button on top of
// and still be readable. Same desktop/mobile split HOME_BANNER_TWO uses.
function NewsletterFields({
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
        label="Desktop banner — recommended size: 1600 × 500px"
      />
      <MediaPicker
        value={config.mobileImageUrl as string | undefined}
        onChange={(url) => onConfigChange({ ...config, mobileImageUrl: url })}
        label="Mobile banner — recommended size: 800 × 800px (falls back to the desktop image if left empty)"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Heading (optional — shown above the email field)</span>
        <input
          value={(config.heading as string | undefined) ?? ""}
          onChange={(e) => onConfigChange({ ...config, heading: e.target.value })}
          placeholder="Subscribe to our newsletter"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Subheading (optional)</span>
        <input
          value={(config.subheading as string | undefined) ?? ""}
          onChange={(e) => onConfigChange({ ...config, subheading: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">
          Heading colour — pick Light for dark artwork, Dark for pale artwork
        </span>
        <select
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          value={(config.textColor as string | undefined) ?? "DARK"}
          onChange={(e) => onConfigChange({ ...config, textColor: e.target.value })}
        >
          <option value="DARK">Dark text</option>
          <option value="LIGHT">Light text</option>
        </select>
      </label>
      {/* Off by default. Only worth turning on when the heading has to sit
          over a busy area of the image. */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-500"
          checked={config.darkOverlay === true}
          onChange={(e) => onConfigChange({ ...config, darkOverlay: e.target.checked })}
        />
        <span className="text-xs font-semibold text-secondary">
          Darken the image behind the form (only if the heading is hard to read)
        </span>
      </label>
    </div>
  );
}
