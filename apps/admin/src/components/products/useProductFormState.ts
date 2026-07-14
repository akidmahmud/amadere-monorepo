import { useState } from "react";
import type { ProductType, StockStatus, AdminProduct } from "@/hooks/useProducts";
import type { PublishStatus } from "@/hooks/useBrands";
import type { GalleryImage } from "./ProductMediaGallery";

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
  const [nutrition, setNutrition] = useState(initial?.translations[0]?.nutrition ?? "");
  const [ingredients, setIngredients] = useState(initial?.translations[0]?.ingredients ?? "");
  const [categoryIds, setCategoryIds] = useState<number[]>(initial?.categoryIds ?? []);
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);
  const [attributeIds, setAttributeIds] = useState<number[]>(initial?.attributeIds ?? []);
  const [images, setImages] = useState<GalleryImage[]>(initial?.media.map((m) => ({ id: m.id, url: m.url })) ?? []);

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
        { locale: "EN" as const, name, description: description || undefined, content: content || undefined, nutrition: nutrition || undefined, ingredients: ingredients || undefined },
        { locale: "BN" as const, name, description: description || undefined, content: content || undefined, nutrition: nutrition || undefined, ingredients: ingredients || undefined },
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
    setNutrition(product.translations[0]?.nutrition ?? "");
    setIngredients(product.translations[0]?.ingredients ?? "");
    setCategoryIds(product.categoryIds);
    setTagIds(product.tagIds);
    setAttributeIds(product.attributeIds);
    setImages(product.media.map((m) => ({ id: m.id, url: m.url })));
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
    nutrition, setNutrition,
    ingredients, setIngredients,
    categoryIds, setCategoryIds,
    tagIds, setTagIds,
    attributeIds, setAttributeIds,
    images, setImages,
    toBasePayload,
    seedFrom,
  };
}

export type ProductFormState = ReturnType<typeof useProductFormState>;
