import { useState } from "react";
import type { ProductType, StockStatus, AdminProduct } from "@/hooks/useProducts";
import type { PublishStatus } from "@/hooks/useBrands";
import type { GalleryImage } from "./ProductMediaGallery";

export interface InfoVisualArrowState {
  heading: string;
  subheading: string;
}

export interface InfoVisualCircleState {
  imageUrl: string;
  label: string;
}

export interface ComparisonCardState {
  imageUrl: string;
  title: string;
  items: string;
}

const EMPTY_ARROW: InfoVisualArrowState = { heading: "", subheading: "" };
const EMPTY_CIRCLE: InfoVisualCircleState = { imageUrl: "", label: "" };

function arrowsFrom(product?: AdminProduct): InfoVisualArrowState[] {
  const arrows = product?.translations[0]?.infoVisualContent?.arrows ?? [];
  return [0, 1, 2, 3].map((i) => ({
    heading: arrows[i]?.heading ?? "",
    subheading: arrows[i]?.subheading ?? "",
  }));
}

function circlesFrom(product?: AdminProduct): InfoVisualCircleState[] {
  const images = product?.infoVisualImages?.circles ?? [];
  const labels = product?.translations[0]?.infoVisualContent?.circleLabels ?? [];
  return [0, 1, 2].map((i) => ({
    imageUrl: images[i] ?? "",
    label: labels[i] ?? "",
  }));
}

function comparisonCardFrom(product: AdminProduct | undefined, card: "card1" | "card2"): ComparisonCardState {
  return {
    imageUrl: product?.comparisonImages?.[card] ?? "",
    title: product?.translations[0]?.comparisonContent?.[card]?.title ?? "",
    items: product?.translations[0]?.comparisonContent?.[card]?.items ?? "",
  };
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
  const [nutrition, setNutrition] = useState(initial?.translations[0]?.nutrition ?? "");
  const [ingredients, setIngredients] = useState(initial?.translations[0]?.ingredients ?? "");
  const [keyBenefits, setKeyBenefits] = useState(initial?.translations[0]?.keyBenefits ?? "");
  const [categoryIds, setCategoryIds] = useState<number[]>(initial?.categoryIds ?? []);
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);
  const [attributeIds, setAttributeIds] = useState<number[]>(initial?.attributeIds ?? []);
  const [images, setImages] = useState<GalleryImage[]>(initial?.media.map((m) => ({ id: m.id, url: m.url })) ?? []);

  // "Product Info Visual" PDP section — per-product, optional.
  const [infoVisualImage, setInfoVisualImage] = useState(initial?.infoVisualImages?.main ?? "");
  const [infoVisualTopHeading, setInfoVisualTopHeading] = useState(
    initial?.translations[0]?.infoVisualContent?.topHeading ?? "",
  );
  const [infoVisualBottomHeading, setInfoVisualBottomHeading] = useState(
    initial?.translations[0]?.infoVisualContent?.bottomHeading ?? "",
  );
  const [infoVisualArrows, setInfoVisualArrows] = useState<InfoVisualArrowState[]>(arrowsFrom(initial));
  const [infoVisualCircles, setInfoVisualCircles] = useState<InfoVisualCircleState[]>(circlesFrom(initial));

  // "Comparison" PDP section — per-product, optional. card1 = "us"
  // (checkmarks), card2 = "them" (X marks), fixed by position.
  const [comparisonHeading, setComparisonHeading] = useState(
    initial?.translations[0]?.comparisonContent?.heading ?? "",
  );
  const [comparisonCard1, setComparisonCard1] = useState<ComparisonCardState>(comparisonCardFrom(initial, "card1"));
  const [comparisonCard2, setComparisonCard2] = useState<ComparisonCardState>(comparisonCardFrom(initial, "card2"));

  function toBasePayload() {
    const infoVisualContent = {
      topHeading: infoVisualTopHeading || undefined,
      bottomHeading: infoVisualBottomHeading || undefined,
      arrows: infoVisualArrows.map((a) => ({ heading: a.heading || undefined, subheading: a.subheading || undefined })),
      circleLabels: infoVisualCircles.map((c) => c.label || ""),
    };
    const comparisonContent = {
      heading: comparisonHeading || undefined,
      card1: { title: comparisonCard1.title || undefined, items: comparisonCard1.items || undefined },
      card2: { title: comparisonCard2.title || undefined, items: comparisonCard2.items || undefined },
    };
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
      infoVisualImages: {
        main: infoVisualImage || undefined,
        circles: infoVisualCircles.map((c) => c.imageUrl || ""),
      },
      comparisonImages: {
        card1: comparisonCard1.imageUrl || undefined,
        card2: comparisonCard2.imageUrl || undefined,
      },
      translations: [
        {
          locale: "EN" as const,
          name,
          description: description || undefined,
          content: content || undefined,
          nutrition: nutrition || undefined,
          ingredients: ingredients || undefined,
          keyBenefits: keyBenefits || undefined,
          infoVisualContent,
          comparisonContent,
        },
        {
          locale: "BN" as const,
          name,
          description: description || undefined,
          content: content || undefined,
          nutrition: nutrition || undefined,
          ingredients: ingredients || undefined,
          keyBenefits: keyBenefits || undefined,
          infoVisualContent,
          comparisonContent,
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
    setNutrition(product.translations[0]?.nutrition ?? "");
    setIngredients(product.translations[0]?.ingredients ?? "");
    setKeyBenefits(product.translations[0]?.keyBenefits ?? "");
    setCategoryIds(product.categoryIds);
    setTagIds(product.tagIds);
    setAttributeIds(product.attributeIds);
    setImages(product.media.map((m) => ({ id: m.id, url: m.url })));
    setInfoVisualImage(product.infoVisualImages?.main ?? "");
    setInfoVisualTopHeading(product.translations[0]?.infoVisualContent?.topHeading ?? "");
    setInfoVisualBottomHeading(product.translations[0]?.infoVisualContent?.bottomHeading ?? "");
    setInfoVisualArrows(arrowsFrom(product));
    setInfoVisualCircles(circlesFrom(product));
    setComparisonHeading(product.translations[0]?.comparisonContent?.heading ?? "");
    setComparisonCard1(comparisonCardFrom(product, "card1"));
    setComparisonCard2(comparisonCardFrom(product, "card2"));
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
    keyBenefits, setKeyBenefits,
    categoryIds, setCategoryIds,
    tagIds, setTagIds,
    attributeIds, setAttributeIds,
    images, setImages,
    infoVisualImage, setInfoVisualImage,
    infoVisualTopHeading, setInfoVisualTopHeading,
    infoVisualBottomHeading, setInfoVisualBottomHeading,
    infoVisualArrows, setInfoVisualArrows,
    infoVisualCircles, setInfoVisualCircles,
    comparisonHeading, setComparisonHeading,
    comparisonCard1, setComparisonCard1,
    comparisonCard2, setComparisonCard2,
    toBasePayload,
    seedFrom,
  };
}

export type ProductFormState = ReturnType<typeof useProductFormState>;
