"use client";

import { useRef, useState } from "react";
import { Icon } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { useAuthors } from "@/hooks/useAuthors";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { AdminProduct } from "@/hooks/useProducts";
import type { ProductFormState } from "@/components/products/useProductFormState";
import { ProductMediaGallery } from "@/components/products/ProductMediaGallery";
import { ProductCategoriesTagsCard } from "@/components/products/ProductCategoriesTagsCard";
import { ProductFaqCard } from "@/components/products/ProductFaqCard";
import { RelatedProductsFields } from "@/components/products/RelatedProductsFields";
import { ProductBadgesField } from "@/components/products/ProductBadgesField";
import { ProductSeoTab } from "@/components/products/ProductSeoTab";
import { ProductAnalyticsTab } from "@/components/products/ProductAnalyticsTab";
import { DigitalFileCard } from "./DigitalFileCard";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const readonlyClass = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-sm text-muted outline-none";

// A digital product has no stock, no variants and no shippable weight — this
// is a from-scratch tab set (General/Media/Digital File/SEO/Analytics), not
// a reuse of ProductFormFields/ProductTabs (which hardcode Inventory/
// Variants/Shipping with no seam to hide them, per the Task 8 brief). The
// underlying field state is still exactly useProductFormState, unforked —
// only the layout around it differs.
const DIGITAL_PRODUCT_TABS = ["General", "Media", "Digital File", "SEO", "Analytics"] as const;
type DigitalProductTab = (typeof DIGITAL_PRODUCT_TABS)[number];

const TAB_ICONS: Record<DigitalProductTab, string> = {
  General: "tune",
  Media: "perm_media",
  "Digital File": "picture_as_pdf",
  SEO: "search",
  Analytics: "monitoring",
};

function SaveFirstNotice() {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-5 text-sm font-semibold text-text">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
        <Icon name="info" size={18} />
      </span>
      <span>Save the product first — this tab needs a real product ID.</span>
    </div>
  );
}

function stripHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(str: string): number {
  const plainText = stripHtml(str);
  return plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
}

const SHORT_DESCRIPTION_MAX_WORDS = 450;

function slugify(str: string): string {
  const ascii = str
    .replace(/\([^)]*\)/g, " ")
    .split("|")[0]
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (ascii) return ascii;
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// Lean stand-in for ProductPricingCard, which is coupled to
// hasVariants/weight-based cost calculation — neither applies to a PDF (no
// variants, no shippable weight). costPriceUnit is never set here, so this
// always takes computeVariantCost's flat-cost path (see variant-cost.ts).
function DigitalPricingCard({ form }: { form: ProductFormState }) {
  const price = Number(form.price) || 0;
  const cost = form.costPerItem.trim() !== "" ? Number(form.costPerItem) : undefined;
  const hasCost = cost !== undefined;
  const profit = price - (cost ?? 0);
  const margin = price > 0 && hasCost ? (profit / price) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Pricing</h3>
      <div className="mb-3.5 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">
            Regular Price (৳)<span className="ml-0.5 text-danger">*</span>
          </span>
          <input type="number" value={form.price} onChange={(e) => form.setPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Sale Price (৳)</span>
          <input type="number" value={form.salePrice} onChange={(e) => form.setSalePrice(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Cost Price (৳, optional)</span>
          <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Sale starts (optional)</span>
          <input type="date" value={form.saleStartsAt} onChange={(e) => form.setSaleStartsAt(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Sale ends (optional)</span>
          <input type="date" value={form.saleEndsAt} onChange={(e) => form.setSaleEndsAt(e.target.value)} className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Profit</span>
          <input readOnly value={hasCost ? `৳ ${profit.toFixed(2)}` : "—"} className={readonlyClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Margin</span>
          <input readOnly value={hasCost && price > 0 ? `${margin.toFixed(2)}%` : "—"} className={readonlyClass} />
        </label>
      </div>
    </div>
  );
}

// The book "Specification" tab on the storefront PDP, and the Author it is
// filed under. Fixed named fields, not free-form rows, so every book carries
// the same seven and they stay filterable later.
//
// Two fields deliberately have NO input of their own here:
//  - "No of Page" is digitalPageCount, read off the uploaded PDF itself
//    (Digital File tab) — a hand-typed second copy could only ever disagree
//    with the file the buyer actually receives.
//  - "Type" is derived from the uploaded file itself (its extension and
//    byte size) rather than typed, so the row can never claim a format the
//    buyer does not actually receive. There is deliberately no Weight row:
//    a downloadable ebook has no shipping weight. Product.shippableWeight is
//    untouched by this form (it stays pinned to 0, as before) and is still a
//    real, editable field on PHYSICAL products.
function BookSpecificationCard({
  form,
  pageCount,
  fileName,
  fileSize,
}: {
  form: ProductFormState;
  pageCount: number | null;
  fileName: string | null;
  fileSize: number | null;
}) {
  const { data: authors } = useAuthors();

  // Mirrors the storefront's own derivation (see products.mapper.ts's
  // digitalFileFormat) so the admin previews exactly what a buyer will read.
  const fileType = (() => {
    const dot = fileName ? fileName.lastIndexOf(".") : -1;
    if (!fileName || dot < 0 || dot === fileName.length - 1) return null;
    const format = fileName.slice(dot + 1).toUpperCase();
    if (!fileSize || fileSize <= 0) return format;
    const mb = fileSize / (1024 * 1024);
    return `${format} · ${mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(fileSize / 1024))} KB`}`;
  })();

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Specification</h3>
      <p className="mb-3.5 text-xs text-muted">
        Rendered as the two-column Specification tab on the book&apos;s page. Blank fields are simply left out of that table.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Author</span>
          <select
            value={form.authorId ?? ""}
            onChange={(e) => form.setAuthorId(e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          >
            <option value="">— No author —</option>
            {(authors ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.translations[0]?.name ?? a.slug}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted">
            Manage the list under Product Management → Authors. Editing an author updates every book by them.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Edition</span>
          <input value={form.bookEdition} onChange={(e) => form.setBookEdition(e.target.value)} placeholder="1st Edition" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">ISBN</span>
          <input value={form.isbn} onChange={(e) => form.setIsbn(e.target.value)} placeholder="978-984-000-000-0" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">No of Page</span>
          <input readOnly value={pageCount != null ? String(pageCount) : "—"} className={readonlyClass} />
          <span className="text-[11px] text-muted">Read from the uploaded PDF (Digital File tab).</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Language</span>
          <input value={form.bookLanguage} onChange={(e) => form.setBookLanguage(e.target.value)} placeholder="Bangla" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Publisher</span>
          <input value={form.bookPublisher} onChange={(e) => form.setBookPublisher(e.target.value)} placeholder="Anyaprokash" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Country</span>
          <input value={form.bookCountry} onChange={(e) => form.setBookCountry(e.target.value)} placeholder="Bangladesh" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Type</span>
          <input readOnly value={fileType ?? "—"} className={readonlyClass} />
          <span className="text-[11px] text-muted">The uploaded file&apos;s format and size (Digital File tab).</span>
        </label>
      </div>
    </div>
  );
}

export interface DigitalProductFormFieldsProps {
  form: ProductFormState;
  /** Undefined on the New Digital Product page — Digital File/SEO/Analytics
   * all need a real product ID that only exists after the first save. */
  productId?: number;
  /** The freshly-loaded product (edit page only) — source of the read-only
   * digitalFile.../previewPages fields the Digital File card renders, since
   * those are written by their own endpoints, not by this form's Save. */
  product?: AdminProduct;
}

export function DigitalProductFormFields({ form, productId, product }: DigitalProductFormFieldsProps) {
  const [tab, setTab] = useState<DigitalProductTab>("General");
  const slugEdited = useRef(false);
  const storefrontUrl = useStorefrontUrl();

  function handleNameChange(v: string) {
    form.setName(v);
    if (!slugEdited.current) form.setSlug(slugify(v));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-2 shadow-xs">
        {DIGITAL_PRODUCT_TABS.map((t) => {
          const isActive = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                isActive ? "bg-[#ecfdf5] text-[#059669] shadow-2xs font-bold" : "bg-transparent text-[#64748b] hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon name={TAB_ICONS[t]} size={18} className={isActive ? "text-[#059669]" : "text-[#64748b]"} />
              <span>{t}</span>
            </button>
          );
        })}
      </div>

      {tab === "General" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-border bg-surface p-[18px]">
              <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Basic Information</h3>
              <label className="mb-3.5 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">
                  Product Name<span className="ml-0.5 text-danger">*</span>
                </span>
                <input value={form.name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} />
              </label>
              <label className="mb-3.5 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">
                  Permalink<span className="ml-0.5 text-danger">*</span>
                </span>
                <div className="flex h-10 items-center overflow-hidden rounded-sm border border-border bg-surface focus-within:border-brand-500">
                  <span className="select-none whitespace-nowrap pl-3 text-sm text-muted">{storefrontUrl}/products/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      slugEdited.current = true;
                      form.setSlug(e.target.value);
                    }}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-sm font-semibold text-text outline-none"
                  />
                </div>
              </label>
              <label className="mb-3.5 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">
                  SKU<span className="ml-0.5 text-danger">*</span>
                </span>
                <input value={form.sku} onChange={(e) => form.setSku(e.target.value)} className={inputClass} />
              </label>
              <div className="mb-3.5 flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-xs font-bold text-text">
                  Short Description
                  <span className={countWords(form.description) > SHORT_DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                    {countWords(form.description)}/{SHORT_DESCRIPTION_MAX_WORDS} words
                  </span>
                </span>
                <RichTextEditor value={form.description} onChange={form.setDescription} compact />
              </div>
              {/* Labelled "Summary" to match the tab this text actually renders
                  as on a digital PDP (BookTabPanels) — staff editing a box called
                  "Full Description" and then seeing "Summary" on the site is the
                  same confusion this form is trying to avoid. Same `content`
                  field underneath; physical products keep their own label. */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Summary</span>
                <RichTextEditor value={form.content} onChange={form.setContent} />
              </div>
              {/* Key Benefits and How to Use are deliberately NOT rendered here.
                  A digital PDP shows Summary / Specification / Author, so neither
                  field has anywhere to appear, and offering them only invites
                  staff to write copy no customer will ever see. The columns stay
                  on the model — physical products still use them, and any value
                  an existing product already holds is left untouched. */}
            </div>

            <div className="rounded-card border border-border bg-surface p-[18px]">
              <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Other Details</h3>
              <label className="mb-3.5 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Badges (optional, up to 5)</span>
                <ProductBadgesField value={form.keyBenefits} onChange={form.setKeyBenefits} />
              </label>
              <StatusSelect value={form.status} onChange={form.setStatus} />
            </div>

            <BookSpecificationCard
              form={form}
              pageCount={product?.digitalPageCount ?? null}
              fileName={product?.digitalFileName ?? null}
              fileSize={product?.digitalFileSize ?? null}
            />

            <ProductFaqCard form={form} />

            {/* Same shared picker the physical product form mounts — the
                related-products field is not digital-specific, only the
                storefront heading is. */}
            {productId && <RelatedProductsFields productId={productId} />}
          </div>

          <div className="flex flex-col gap-4">
            <DigitalPricingCard form={form} />
            <ProductCategoriesTagsCard form={form} />
          </div>
        </div>
      )}

      {tab === "Media" && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs">
          <h3 className="mb-5 text-base font-extrabold text-[#064e3b]">Media (cover image)</h3>
          <ProductMediaGallery images={form.images} onChange={form.setImages} />
          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Video URL (optional)</span>
            <input
              value={form.videoUrl}
              onChange={(e) => form.setVideoUrl(e.target.value)}
              className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30 placeholder:text-emerald-900/40"
              placeholder="https://youtube.com/..."
            />
          </label>
          <label className="mt-4 flex items-center gap-2.5 text-sm font-bold text-emerald-950 cursor-pointer select-none">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => form.setIsFeatured(e.target.checked)} className="h-4 w-4 rounded accent-emerald-700" />
            Featured Product
          </label>
        </div>
      )}

      {tab === "Digital File" &&
        (productId ? (
          <DigitalFileCard
            productId={productId}
            digitalFileName={product?.digitalFileName ?? null}
            digitalFileSize={product?.digitalFileSize ?? null}
            digitalPageCount={product?.digitalPageCount ?? null}
            digitalPreviewStartPage={product?.digitalPreviewStartPage ?? null}
            digitalPreviewEndPage={product?.digitalPreviewEndPage ?? null}
            previewPages={product?.previewPages ?? []}
          />
        ) : (
          <SaveFirstNotice />
        ))}

      {tab === "SEO" && (
        <ProductSeoTab
          productId={productId}
          slug={form.slug}
          name={form.name}
          description={form.description}
          primaryImageAlt={form.images[0]?.alt ?? ""}
          primaryImageUrl={form.images[0]?.url}
        />
      )}

      {tab === "Analytics" && (productId ? <ProductAnalyticsTab productId={productId} /> : <SaveFirstNotice />)}
    </div>
  );
}
