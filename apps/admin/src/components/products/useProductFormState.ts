import { useState } from "react";
import type { ProductType, StockStatus, AdminProduct } from "@/hooks/useProducts";
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
  shippableWeight: string;
  minOrderQuantity: string;
  maxOrderQuantity: string;
  name: string;
  description: string;
  content: string;
  keyBenefits: string;
  benefitPoints: string;
  howToUse: string;
  categoryIds: number[];
  tagIds: number[];
  attributeIds: number[];
  images: GalleryImage[];
}

export function useProductFormState(initial?: AdminProduct) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [brandId, setBrandId] = useState<number | undefined>(initial?.brandId ?? undefined);
  const [productType, setProductType] = useState<ProductType>(initial?.productType ?? "PHYSICAL");
  const [status, setStatus] = useState<PublishStatus>(initial?.status ?? "DRAFT");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
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
  const [categoryIds, setCategoryIds] = useState<number[]>(initial?.categoryIds ?? []);
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);
  const [attributeIds, setAttributeIds] = useState<number[]>(initial?.attributeIds ?? []);
  const [images, setImages] = useState<GalleryImage[]>(initial?.media.map((m) => ({ id: m.id, url: m.url, alt: m.altText })) ?? []);

  function toBasePayload() {
    return {
      slug,
      sku: sku || undefined,
      brandId,
      productType,
      status,
      isFeatured,
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
        },
        {
          locale: "BN" as const,
          name,
          description: description || undefined,
          content: content || undefined,
          keyBenefits: keyBenefits || undefined,
          benefitPoints: benefitPoints || undefined,
          howToUse: howToUse || undefined,
        },
      ],
      categoryIds,
      tagIds,
      attributeIds,
      mediaIds: images.map((i) => i.id),
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
    setShippableWeight(product.shippableWeight ?? "");
    setMinOrderQuantity(String(product.minOrderQuantity));
    setMaxOrderQuantity(product.maxOrderQuantity != null ? String(product.maxOrderQuantity) : "");
    setName(product.translations[0]?.name ?? "");
    setDescription(product.translations[0]?.description ?? "");
    setContent(product.translations[0]?.content ?? "");
    setKeyBenefits(product.translations[0]?.keyBenefits ?? "");
    setBenefitPoints(product.translations[0]?.benefitPoints ?? "");
    setHowToUse(product.translations[0]?.howToUse ?? "");
    setCategoryIds(product.categoryIds);
    setTagIds(product.tagIds);
    setAttributeIds(product.attributeIds);
    setImages(product.media.map((m) => ({ id: m.id, url: m.url, alt: m.altText })));
  }

  function getSnapshot(): ProductFormSnapshot {
    return {
      slug, sku, brandId, productType, status, isFeatured, videoUrl, hasVariants, trackInventory, allowBackorder,
      stock, stockStatus, price, salePrice, saleStartsAt, saleEndsAt, costPerItem, shippableWeight,
      minOrderQuantity, maxOrderQuantity, name, description, content, keyBenefits, benefitPoints, howToUse,
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
    setShippableWeight(s.shippableWeight);
    setMinOrderQuantity(s.minOrderQuantity);
    setMaxOrderQuantity(s.maxOrderQuantity);
    setName(s.name);
    setDescription(s.description);
    setContent(s.content);
    setKeyBenefits(s.keyBenefits);
    setBenefitPoints(s.benefitPoints);
    setHowToUse(s.howToUse);
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
    shippableWeight, setShippableWeight,
    minOrderQuantity, setMinOrderQuantity,
    maxOrderQuantity, setMaxOrderQuantity,
    name, setName,
    description, setDescription,
    content, setContent,
    keyBenefits, setKeyBenefits,
    benefitPoints, setBenefitPoints,
    howToUse, setHowToUse,
    categoryIds, setCategoryIds,
    tagIds, setTagIds,
    attributeIds, setAttributeIds,
    images, setImages,
    toBasePayload,
    seedFrom,
    getSnapshot,
    applySnapshot,
  };
}

export type ProductFormState = ReturnType<typeof useProductFormState>;
