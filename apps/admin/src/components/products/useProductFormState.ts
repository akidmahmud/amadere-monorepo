import { useState } from "react";
import type { CostPriceUnit, ProductFlagLabel, ProductType, StockStatus, AdminProduct } from "@/hooks/useProducts";
import type { PublishStatus } from "@/hooks/useBrands";
import type { GalleryImage } from "./ProductMediaGallery";

// Flat snapshot of every editable field — the autosave draft shape. Distinct
// from toBasePayload() (the create/update API shape: nested translations,
// mediaIds instead of full image objects, numeric strings coerced to
// numbers) because a draft needs to round-trip back into these exact
// `useState` setters, not survive a trip through the API.
export interface ProductFormSnapshot {
  slug: string;
  sku: string;
  brandId: number | undefined;
  productType: ProductType;
  status: PublishStatus;
  isFeatured: boolean;
  flagLabel: ProductFlagLabel | null;
  videoUrl: string;
  hasVariants: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  stock: string;
  stockStatus: StockStatus;
  price: string;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  costPerItem: string;
  costPriceUnit: CostPriceUnit | null;
  shippableWeight: string;
  minOrderQuantity: string;
  maxOrderQuantity: string;
  name: string;
  description: string;
  content: string;
  keyBenefits: string;
  benefitPoints: string;
  howToUse: string;
  faqs: { question: string; answer: string }[];
  categoryIds: number[];
  tagIds: number[];
  attributeIds: number[];
  images: GalleryImage[];
}

// Short Description is HTML (compact RichTextEditor) — this strips tags for
// the word-count check below only, never the stored/edited value itself
// (that would silently destroy any real formatting every time an existing
// product is reopened for editing).
const SHORT_DESCRIPTION_MAX_WORDS = 450;

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
  const plain = stripHtml(str);
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0;
}

export function useProductFormState(initial?: AdminProduct) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [brandId, setBrandId] = useState<number | undefined>(initial?.brandId ?? undefined);
  const [productType, setProductType] = useState<ProductType>(initial?.productType ?? "PHYSICAL");
  const [status, setStatus] = useState<PublishStatus>(initial?.status ?? "DRAFT");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [flagLabel, setFlagLabel] = useState<ProductFlagLabel | null>(initial?.flagLabel ?? null);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [hasVariants, setHasVariants] = useState(initial?.hasVariants ?? false);
  const [trackInventory, setTrackInventory] = useState(initial?.trackInventory ?? true);
  const [allowBackorder, setAllowBackorder] = useState(initial?.allowBackorder ?? false);
  const [stock, setStock] = useState(String(initial?.stock ?? 0));
  const [stockStatus, setStockStatus] = useState<StockStatus>(initial?.stockStatus ?? "IN_STOCK");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? "");
  const [saleStartsAt, setSaleStartsAt] = useState(initial?.saleStartsAt?.slice(0, 10) ?? "");
  const [saleEndsAt, setSaleEndsAt] = useState(initial?.saleEndsAt?.slice(0, 10) ?? "");
  const [costPerItem, setCostPerItem] = useState(initial?.costPerItem ?? "");
  const [costPriceUnit, setCostPriceUnit] = useState<CostPriceUnit | null>(initial?.costPriceUnit ?? null);
  const [shippableWeight, setShippableWeight] = useState(initial?.shippableWeight ?? "");
  const [minOrderQuantity, setMinOrderQuantity] = useState(String(initial?.minOrderQuantity ?? 1));
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(
    initial?.maxOrderQuantity != null ? String(initial.maxOrderQuantity) : "",
  );
  const [name, setName] = useState(initial?.translations[0]?.name ?? "");
  const [description, setDescription] = useState(initial?.translations[0]?.description ?? "");
  const [content, setContent] = useState(initial?.translations[0]?.content ?? "");
  const [keyBenefits, setKeyBenefits] = useState(initial?.translations[0]?.keyBenefits ?? "");
  const [benefitPoints, setBenefitPoints] = useState(initial?.translations[0]?.benefitPoints ?? "");
  const [howToUse, setHowToUse] = useState(initial?.translations[0]?.howToUse ?? "");
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(
    initial?.translations[0]?.faqs?.map((f) => ({ question: f.question, answer: f.answer })) ?? [],
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(initial?.categoryIds ?? []);
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);
  const [attributeIds, setAttributeIds] = useState<number[]>(initial?.attributeIds ?? []);
  const [images, setImages] = useState<GalleryImage[]>(initial?.media.map((m) => ({ id: m.id, url: m.url, alt: m.altText, variantId: m.variantId })) ?? []);

  function toBasePayload() {
    const cleanFaqs = faqs
      .map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), sortOrder: i }))
      .filter((f) => f.question && f.answer);
    return {
      slug,
      sku: sku || undefined,
      brandId,
      productType,
      status,
      isFeatured,
      flagLabel,
      videoUrl: videoUrl || undefined,
      hasVariants,
      trackInventory,
      allowBackorder,
      stock: Number(stock),
      stockStatus,
      price: hasVariants ? undefined : price ? Number(price) : undefined,
      salePrice: hasVariants ? undefined : salePrice ? Number(salePrice) : undefined,
      saleStartsAt: saleStartsAt || undefined,
      saleEndsAt: saleEndsAt || undefined,
      costPerItem: costPerItem ? Number(costPerItem) : undefined,
      // Always sent explicitly (never omitted) so unchecking "calculate per
      // variant by weight" actually clears a previously-set unit — the
      // update endpoint treats an omitted/undefined field as "leave
      // unchanged", only an explicit null clears it.
      costPriceUnit,
      shippableWeight: shippableWeight ? Number(shippableWeight) : undefined,
      minOrderQuantity: Number(minOrderQuantity),
      maxOrderQuantity: maxOrderQuantity ? Number(maxOrderQuantity) : undefined,
      translations: [
        {
          locale: "EN" as const,
          name,
          description: description || undefined,
          content: content || undefined,
          keyBenefits: keyBenefits || undefined,
          benefitPoints: benefitPoints || undefined,
          howToUse: howToUse || undefined,
          faqs: cleanFaqs,
        },
        {
          locale: "BN" as const,
          name,
          description: description || undefined,
          content: content || undefined,
          keyBenefits: keyBenefits || undefined,
          benefitPoints: benefitPoints || undefined,
          howToUse: howToUse || undefined,
          faqs: cleanFaqs,
        },
      ],
      categoryIds,
      tagIds,
      attributeIds,
      mediaIds: images.map((i) => i.id),
      // Sent alongside mediaIds (which still owns order + primary) so the
      // backend can pin images to variants. Always sent — an explicit empty
      // list is how "no image is pinned any more" is expressed; omitting it
      // means "don't touch existing assignments" server-side.
      mediaVariantAssignments: images.map((i) => ({
        mediaId: i.id,
        variantId: i.variantId ?? null,
      })),
    };
  }

  // `initial` is only read at mount — the edit page's product query resolves
  // asynchronously (starts undefined), so `useState(initial?.x ?? ...)` alone
  // would never pick up the real data once it loads. The edit page calls this
  // in a `useEffect([product])` once the fetch completes, same fix already
  // applied on every other module's edit page this build.
  function seedFrom(product: AdminProduct) {
    setSlug(product.slug);
    setSku(product.sku ?? "");
    setBrandId(product.brandId ?? undefined);
    setProductType(product.productType);
    setStatus(product.status);
    setIsFeatured(product.isFeatured);
    setFlagLabel(product.flagLabel);
    setVideoUrl(product.videoUrl ?? "");
    setHasVariants(product.hasVariants);
    setTrackInventory(product.trackInventory);
    setAllowBackorder(product.allowBackorder);
    setStock(String(product.stock));
    setStockStatus(product.stockStatus);
    setPrice(product.price ?? "");
    setSalePrice(product.salePrice ?? "");
    setSaleStartsAt(product.saleStartsAt?.slice(0, 10) ?? "");
    setSaleEndsAt(product.saleEndsAt?.slice(0, 10) ?? "");
    setCostPerItem(product.costPerItem ?? "");
    setCostPriceUnit(product.costPriceUnit);
    setShippableWeight(product.shippableWeight ?? "");
    setMinOrderQuantity(String(product.minOrderQuantity));
    setMaxOrderQuantity(product.maxOrderQuantity != null ? String(product.maxOrderQuantity) : "");
    setName(product.translations[0]?.name ?? "");
    setDescription(product.translations[0]?.description ?? "");
    setContent(product.translations[0]?.content ?? "");
    setKeyBenefits(product.translations[0]?.keyBenefits ?? "");
    setBenefitPoints(product.translations[0]?.benefitPoints ?? "");
    setHowToUse(product.translations[0]?.howToUse ?? "");
    setFaqs(product.translations[0]?.faqs?.map((f) => ({ question: f.question, answer: f.answer })) ?? []);
    setCategoryIds(product.categoryIds);
    setTagIds(product.tagIds);
    setAttributeIds(product.attributeIds);
    setImages(product.media.map((m) => ({ id: m.id, url: m.url, alt: m.altText, variantId: m.variantId })));
  }

  // Pure client-side gate before a save request ever goes out — the backend
  // itself treats nearly all of these as optional (see CreateProductDto), so
  // this is an admin-panel business rule, not a data-integrity one. Returns
  // every missing field at once so the caller can show one consolidated
  // toast instead of failing fields one at a time across repeated save clicks.
  function validate(variantCount: number): string[] {
    const missing: string[] = [];
    if (!name.trim()) missing.push("Product Name");
    if (!slug.trim()) missing.push("Permalink");
    if (categoryIds.length === 0) missing.push("Category");
    if (images.length === 0) missing.push("Media");
    if (!sku.trim()) missing.push("SKU");
    if (!shippableWeight.trim()) missing.push("Shippable weight");
    if (!minOrderQuantity.trim() || Number(minOrderQuantity) < 1) missing.push("Min order quantity");
    if (countWords(description) > SHORT_DESCRIPTION_MAX_WORDS) {
      missing.push(`Short Description (exceeds limit by ${countWords(description) - SHORT_DESCRIPTION_MAX_WORDS} word(s))`);
    }
    if (hasVariants) {
      if (variantCount === 0) missing.push("Variants (add at least one)");
    } else {
      if (!price.trim() || Number(price) <= 0) missing.push("Price");
      // Only required when inventory is actually being tracked — unchecking
      // "Track inventory" means stock isn't meaningful for this product, so
      // it shouldn't block Save/Save & Exit.
      if (trackInventory && !stock.trim()) missing.push("Stock");
    }
    return missing;
  }

  function getSnapshot(): ProductFormSnapshot {
    return {
      slug, sku, brandId, productType, status, isFeatured, flagLabel, videoUrl, hasVariants, trackInventory, allowBackorder,
      stock, stockStatus, price, salePrice, saleStartsAt, saleEndsAt, costPerItem, costPriceUnit, shippableWeight,
      minOrderQuantity, maxOrderQuantity, name, description, content, keyBenefits, benefitPoints, howToUse, faqs,
      categoryIds, tagIds, attributeIds, images,
    };
  }

  function applySnapshot(s: ProductFormSnapshot) {
    setSlug(s.slug);
    setSku(s.sku);
    setBrandId(s.brandId);
    setProductType(s.productType);
    setStatus(s.status);
    setIsFeatured(s.isFeatured);
    setFlagLabel(s.flagLabel);
    setVideoUrl(s.videoUrl);
    setHasVariants(s.hasVariants);
    setTrackInventory(s.trackInventory);
    setAllowBackorder(s.allowBackorder);
    setStock(s.stock);
    setStockStatus(s.stockStatus);
    setPrice(s.price);
    setSalePrice(s.salePrice);
    setSaleStartsAt(s.saleStartsAt);
    setSaleEndsAt(s.saleEndsAt);
    setCostPerItem(s.costPerItem);
    setCostPriceUnit(s.costPriceUnit);
    setShippableWeight(s.shippableWeight);
    setMinOrderQuantity(s.minOrderQuantity);
    setMaxOrderQuantity(s.maxOrderQuantity);
    setName(s.name);
    setDescription(s.description);
    setContent(s.content);
    setKeyBenefits(s.keyBenefits);
    setBenefitPoints(s.benefitPoints);
    setHowToUse(s.howToUse);
    setFaqs(s.faqs);
    setCategoryIds(s.categoryIds);
    setTagIds(s.tagIds);
    setAttributeIds(s.attributeIds);
    setImages(s.images);
  }

  return {
    slug, setSlug,
    sku, setSku,
    brandId, setBrandId,
    productType, setProductType,
    status, setStatus,
    isFeatured, setIsFeatured,
    flagLabel, setFlagLabel,
    videoUrl, setVideoUrl,
    hasVariants, setHasVariants,
    trackInventory, setTrackInventory,
    allowBackorder, setAllowBackorder,
    stock, setStock,
    stockStatus, setStockStatus,
    price, setPrice,
    salePrice, setSalePrice,
    saleStartsAt, setSaleStartsAt,
    saleEndsAt, setSaleEndsAt,
    costPerItem, setCostPerItem,
    costPriceUnit, setCostPriceUnit,
    shippableWeight, setShippableWeight,
    minOrderQuantity, setMinOrderQuantity,
    maxOrderQuantity, setMaxOrderQuantity,
    name, setName,
    description, setDescription,
    content, setContent,
    keyBenefits, setKeyBenefits,
    benefitPoints, setBenefitPoints,
    howToUse, setHowToUse,
    faqs, setFaqs,
    categoryIds, setCategoryIds,
    tagIds, setTagIds,
    attributeIds, setAttributeIds,
    images, setImages,
    toBasePayload,
    seedFrom,
    getSnapshot,
    applySnapshot,
    validate,
  };
}

export type ProductFormState = ReturnType<typeof useProductFormState>;
