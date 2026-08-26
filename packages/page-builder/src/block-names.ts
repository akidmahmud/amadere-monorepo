/**
 * The block registry, as names only.
 *
 * Names are declared here in Phase 1, ahead of the components themselves
 * (Phases 2 and 4), so publish validation can reject an unknown block from the
 * very first document — a layout referencing a block that does not exist is
 * exactly the corruption §6.2.1 is meant to catch, and a validator that
 * accepts everything until the components land would not catch it.
 *
 * No React import: the backend reads this list.
 */

/**
 * Server-safe content blocks that are IMPLEMENTED and renderable today.
 *
 * This list is the validator's allowlist, so it must never run ahead of the
 * config: a name accepted here but missing from `contentBlocks` would publish
 * cleanly and then render a blank space on the live page — the exact class of
 * failure validation exists to prevent.
 */
export const CONTENT_BLOCK_NAMES = [
  "Section",
  "Columns",
  "Heading",
  "RichText",
  "Image",
  "Button",
  "Spacer",
  "HtmlEmbed",
  "HtmlPage",
] as const;

/**
 * Planned but not yet built (plan §7.1). Deliberately NOT part of
 * ALL_BLOCK_NAMES — see the note above. Each needs product/collection data,
 * which a block cannot fetch for itself under the §4 import boundary; the
 * storefront will hand it in through Puck metadata when these land.
 */
export const PLANNED_CONTENT_BLOCK_NAMES = [
  "Faq",
  "ProductGrid",
  "ProductCarousel",
  "PromoVideo",
  "NewsletterBanner",
] as const;

/** Client checkout blocks — plan §7.2. */
export const CHECKOUT_BLOCK_NAMES = [
  "CheckoutRoot",
  "CheckoutOrderReview",
  "CheckoutShippingAddress",
  "CheckoutContactDetails",
  "CheckoutBillingAddress",
  "CheckoutPaymentMethod",
  "CheckoutOrderSummary",
  "CheckoutCoupon",
  "CheckoutGiftVoucher",
  "CheckoutCustomerNote",
  "CheckoutTerms",
  "CheckoutPlaceOrder",
  "CheckoutUpsellBar",
  "CheckoutFbt",
  "CheckoutCrossSell",
  // Sells ONE product straight from a landing page: pack picker, quantity,
  // live bill and the real order form. Distinct from the cart-driven blocks
  // above, which render whatever is already in the cart.
  "CheckoutProductCard",
] as const;

export const ALL_BLOCK_NAMES = [
  ...CONTENT_BLOCK_NAMES,
  ...CHECKOUT_BLOCK_NAMES,
] as const;

export type ContentBlockName = (typeof CONTENT_BLOCK_NAMES)[number];
export type CheckoutBlockName = (typeof CHECKOUT_BLOCK_NAMES)[number];
export type BlockName = (typeof ALL_BLOCK_NAMES)[number];

const CHECKOUT_SET: ReadonlySet<string> = new Set(CHECKOUT_BLOCK_NAMES);
const ALL_SET: ReadonlySet<string> = new Set(ALL_BLOCK_NAMES);

export function isKnownBlock(name: string): name is BlockName {
  return ALL_SET.has(name);
}

export function isCheckoutBlock(name: string): name is CheckoutBlockName {
  return CHECKOUT_SET.has(name);
}
