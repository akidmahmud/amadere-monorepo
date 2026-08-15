import type { components } from "@/lib/api/schema";
import type { ProductCardData } from "@/lib/product-card-mapper";

type PublicProductDto = components["schemas"]["PublicProductDto"];
type CartLineItemDto = components["schemas"]["CartLineItemDto"];

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

// ---------------------------------------------------------------------
// GA4 ecommerce events (https://developers.google.com/analytics/devguides/
// collection/ga4/ecommerce?client_type=gtm) — pushed to window.dataLayer in
// GTM's documented shape so any GTM container (this site's is proxied
// through PixelFly, not loaded natively — see AnalyticsScripts.tsx) can
// pick these up via a Custom Event trigger + Data Layer Variables. This is
// the *only* client-side purchase mechanism now — a direct gtag/fbq/ttq
// call used to fire alongside this (fireClientPurchase), but that duplicated
// what GTM tags already do when they see this same dataLayer purchase event,
// so it was removed; GTM (client- and server-side) is the single source of
// truth for actually firing vendor conversions.
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

// Google's documented "Enhanced Conversions via GTM" user-data shape
// (https://support.google.com/google-ads/answer/13258081), pushed as a
// sibling top-level `user_data` key alongside `event`/`ecommerce` — the same
// convention GA4/Ads/Meta CAPI tags in GTM read customer PII from for
// conversion match quality. Every field is optional: a checkout event fired
// before the customer has typed their address only carries what's actually
// known at that point.
export interface Ga4UserData {
  email?: string;
  phone_number?: string;
  /** ISO date (YYYY-MM-DD) — a Meta CAPI matching parameter (`db`), not part
   * of Google's own Enhanced Conversions schema, but harmless to include
   * alongside it since GTM tags simply read the fields they know about. */
  date_of_birth?: string;
  address?: {
    first_name?: string;
    last_name?: string;
    street?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

// Shared by both the checkout form (values still being typed) and the
// placed-order confirmation (final, validated address) — same field names
// as CheckoutAddressDto/OrderAddressDto, so either can be passed straight
// through. recipientName is split on the first space into first/last since
// neither DTO tracks them separately (BD checkout only ever collects one
// "Full name" field).
export function addressToUserData(address: {
  recipientName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine?: string | null;
  area?: string | null;
  district?: string | null;
  postCode?: string | null;
} | null | undefined): Ga4UserData | undefined {
  if (!address) return undefined;
  const name = address.recipientName?.trim();
  const spaceIndex = name?.indexOf(" ") ?? -1;
  const firstName = spaceIndex > 0 ? name!.slice(0, spaceIndex) : name;
  const lastName = spaceIndex > 0 ? name!.slice(spaceIndex + 1) : undefined;
  const street = [address.addressLine, address.area].filter(Boolean).join(", ") || undefined;

  const hasAnyField = address.email || address.phone || name || street || address.district || address.postCode;
  if (!hasAnyField) return undefined;

  return {
    email: address.email?.trim() || undefined,
    phone_number: address.phone?.trim() || undefined,
    address: {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      street,
      city: address.district?.trim() || undefined,
      postal_code: address.postCode?.trim() || undefined,
      country: "BD",
    },
  };
}

// Clears the previous event's `ecommerce` object before pushing the new
// one — Google's own examples always do this, since GTM's dataLayer merges
// nested objects by default and a stale field (e.g. a previous event's
// `coupon`) would otherwise silently leak into events that never set it.
// `userData`, when given, rides along as a sibling `user_data` key on the
// same push — GTM tags (enhanced conversions, Meta CAPI) read it off
// whichever event they're triggered by.
export function pushEcommerceEvent(event: string, ecommerce: Ga4EcommercePayload, userData?: Ga4UserData): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce, ...(userData ? { user_data: userData } : {}) });
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

