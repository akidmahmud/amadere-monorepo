import { getUtmParams } from "@/lib/utm";
import type { components } from "@/lib/api/schema";
import type { ProductCardData } from "@/lib/product-card-mapper";

type PublicProductDto = components["schemas"]["PublicProductDto"];
type CartLineItemDto = components["schemas"]["CartLineItemDto"];

interface PurchaseInput {
  orderNumber: string;
  totalAmount: string;
  currency: string;
  items: { name: string; price: number; quantity: number }[];
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (...args: unknown[]) => void };
    __amaderAdsConversion?: string | null;
    dataLayer?: Record<string, unknown>[];
  }
}

// ---------------------------------------------------------------------
// GA4 ecommerce events (https://developers.google.com/analytics/devguides/
// collection/ga4/ecommerce?client_type=gtm) — pushed to window.dataLayer in
// GTM's documented shape so any GTM container (this site's is proxied
// through PixelFly, not loaded natively — see AnalyticsScripts.tsx) can
// pick these up via a Custom Event trigger + Data Layer Variables. This is
// a separate, additive mechanism from fireClientPurchase below (which
// calls gtag/fbq/ttq directly) — that one keeps working exactly as before.
// ---------------------------------------------------------------------

export interface Ga4Item {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
}

export interface Ga4EcommercePayload {
  currency?: string;
  value?: number;
  items?: Ga4Item[];
  [key: string]: unknown;
}

// Clears the previous event's `ecommerce` object before pushing the new
// one — Google's own examples always do this, since GTM's dataLayer merges
// nested objects by default and a stale field (e.g. a previous event's
// `coupon`) would otherwise silently leak into events that never set it.
export function pushEcommerceEvent(event: string, ecommerce: Ga4EcommercePayload): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce });
}

// Full PDP-loaded product → GA4 item. Uses the default variant's price for
// variant-only products (mirrors product-card-mapper.ts's own price logic).
// item_id is always the bare product id, deliberately NOT the SKU — the
// cart/order DTOs this same product can later appear in (CartLineItemDto,
// OrderItemDto) don't reliably carry a SKU, and GA4 needs the *same*
// item_id for a product across view_item/add_to_cart/purchase to aggregate
// correctly; variant differences are reported via item_variant instead.
export function productToGa4Item(
  product: PublicProductDto,
  opts?: { quantity?: number; index?: number; listId?: string; listName?: string; variantId?: number },
): Ga4Item {
  // Variant-only products carry no price on the product itself — an
  // explicit variantId picks that exact variant, otherwise fall back to the
  // default (or first) variant, same as product-card-mapper.ts's own price
  // logic, instead of silently reporting 0.
  const variant =
    opts?.variantId != null
      ? product.variants.find((v) => v.id === opts.variantId)
      : product.hasVariants
        ? (product.variants.find((v) => v.isDefault) ?? product.variants[0])
        : undefined;
  const price = Number(variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.price ?? 0);
  return {
    item_id: String(product.id),
    item_name: product.name,
    item_brand: product.brand?.name,
    item_category: product.categories[0]?.name,
    item_variant: variant ? variant.attributeValues.map((a) => a.value).join(" / ") : undefined,
    price,
    quantity: opts?.quantity,
    item_list_id: opts?.listId,
    item_list_name: opts?.listName,
    index: opts?.index,
  };
}

// Listing/card-context product → GA4 item. Leaner than productToGa4Item
// (ProductCardData never carries brand/category — both are optional GA4
// fields, so this simply omits them rather than fetching more data just
// for tracking).
export function cardToGa4Item(
  card: ProductCardData,
  opts?: { index?: number; listId?: string; listName?: string },
): Ga4Item {
  return {
    item_id: String(card.productId),
    item_name: card.name,
    price: Number(card.price),
    item_list_id: opts?.listId,
    item_list_name: opts?.listName,
    index: opts?.index,
  };
}

// Cart/checkout-context line item → GA4 item.
export function cartLineToGa4Item(line: CartLineItemDto): Ga4Item {
  return {
    item_id: String(line.productId),
    item_name: line.name,
    item_variant: line.variantLabel ?? undefined,
    price: Number(line.unitPrice),
    quantity: line.quantity,
  };
}

// Fires the one client-side event that actually matters for ecommerce
// tracking (purchase) into whichever pixels the admin has configured —
// guarded on the global each vendor's own script installs, so a disabled/
// unconfigured provider is silently skipped instead of throwing. Called
// once from OrderConfirmation on mount; server-side purchase/CAPI/Events-API
// forwarding already happens independently via the backend's
// AnalyticsEventListener (order.created), this only covers the browser side
// (retargeting audiences, browser-attributed conversions) that a server
// event alone can't provide.
export function fireClientPurchase(order: PurchaseInput): void {
  if (typeof window === "undefined") return;
  const value = Number(order.totalAmount);
  const utm = getUtmParams();

  if (typeof window.gtag === "function") {
    window.gtag("event", "purchase", {
      transaction_id: order.orderNumber,
      currency: order.currency,
      value,
      items: order.items.map((i) => ({ item_name: i.name, price: i.price, quantity: i.quantity })),
      ...utm,
    });
    if (window.__amaderAdsConversion) {
      window.gtag("event", "conversion", {
        send_to: window.__amaderAdsConversion,
        value,
        currency: order.currency,
        transaction_id: order.orderNumber,
      });
    }
  }

  if (typeof window.fbq === "function") {
    window.fbq("track", "Purchase", { value, currency: order.currency, content_ids: [order.orderNumber] });
  }

  if (window.ttq && typeof window.ttq.track === "function") {
    window.ttq.track("CompletePayment", {
      value,
      currency: order.currency,
      content_id: order.orderNumber,
    });
  }
}
