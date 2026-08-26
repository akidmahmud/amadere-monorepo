import type { Config } from "@puckeditor/core";
import { CHECKOUT_BLOCK_NAMES } from "../../block-names";
import { CheckoutSlot } from "./slots-context";
import type { CheckoutSlotProps } from "./slots-context";

/**
 * Checkout blocks — plan §7.2 step 4.
 *
 * THE PROBLEM THIS SOLVES
 *
 * These blocks must live in the shared package, because the admin editor needs
 * them in its canvas and the admin cannot import from apps/web. But their
 * actual markup needs the checkout brain, which lives in apps/web and cannot
 * move here (it pulls the API client, cart hooks, analytics, and the order
 * mutation).
 *
 * So the package owns the SCHEMA -- block names, fields, labels, categories,
 * which is what a stored document and its validation are made of -- and each
 * app supplies the RENDERING through this context. The storefront provides the
 * real components; the admin provides labelled placeholders. The document is
 * identical either way, which is what keeps a layout portable between them.
 *
 * The inversion also keeps rule §2.1 honest: a block here cannot contain
 * business logic, because it contains no logic at all.
 */

// The client half lives in its own "use client" module. Keeping it here would
// make THIS module a client module, and then `checkoutBlocks` below becomes a
// client reference the server renderer cannot read -- which silently dropped
// every checkout block on a server-rendered page.
export {
  CheckoutSlotsProvider,
  type CheckoutSlotProps,
  type CheckoutSlotComponent,
  type CheckoutSlotMap,
} from "./slots-context";

/** Presentation-only fields. Never field names, required-ness, validation
 *  messages, or the payment provider list -- see plan §7.2 step 4. */
const HEADING_FIELD = { heading: { type: "text" as const } };

const LABELS: Record<string, string> = {
  CheckoutRoot: "Checkout root",
  CheckoutOrderReview: "Order review",
  CheckoutShippingAddress: "Shipping address",
  CheckoutContactDetails: "Contact details",
  CheckoutBillingAddress: "Billing address",
  CheckoutPaymentMethod: "Payment method",
  CheckoutOrderSummary: "Order summary",
  CheckoutCoupon: "Coupon",
  CheckoutGiftVoucher: "Gift voucher",
  CheckoutCustomerNote: "Customer note",
  CheckoutTerms: "Terms agreement",
  CheckoutPlaceOrder: "Place order button",
  CheckoutUpsellBar: "Upsell progress bar",
  CheckoutFbt: "Frequently bought together",
  CheckoutCrossSell: "Cross-sell",
  CheckoutProductCard: "Product order card",
};

/** Blocks whose visible title the owner may reword. */
const HAS_HEADING = new Set([
  "CheckoutOrderReview",
  "CheckoutShippingAddress",
  "CheckoutContactDetails",
  "CheckoutBillingAddress",
  "CheckoutPaymentMethod",
  "CheckoutOrderSummary",
  "CheckoutCoupon",
  "CheckoutGiftVoucher",
]);

/**
 * The order-card block's own fields. `productSlug` rather than an id: the
 * public product endpoint is keyed by slug, so the storefront can resolve it
 * without an admin-only lookup. Packs and prices are then read live from that
 * product -- never copied into the block, which would silently go stale the
 * first time a price changed.
 */
const PRODUCT_CARD_FIELDS = {
  productSlug: { type: "text" as const },
  showImage: {
    type: "radio" as const,
    options: [
      { label: "Show product image", value: "yes" },
      { label: "No image", value: "no" },
    ],
  },
  heading: { type: "text" as const },
  subheading: { type: "text" as const },
  ctaLabel: { type: "text" as const },
  whatsappNumber: { type: "text" as const },
};

function makeBlock(name: string) {
  const isRoot = name === "CheckoutRoot";
  const isProductCard = name === "CheckoutProductCard";
  return {
    label: LABELS[name] ?? name,
    fields: {
      ...(isProductCard ? PRODUCT_CARD_FIELDS : {}),
      ...(isRoot
        ? {
            // Two slots so the owner can move blocks between the main column
            // and the sidebar, which is the single most likely rearrangement.
            main: { type: "slot" as const },
            sidebar: { type: "slot" as const },
          }
        : {}),
      ...(HAS_HEADING.has(name) ? HEADING_FIELD : {}),
      ...(name === "CheckoutPlaceOrder"
        ? { ctaLabel: { type: "text" as const } }
        : {}),
    },
    defaultProps: {
      ...(isProductCard
        ? {
            productSlug: "",
            showImage: "yes",
            heading: "অর্ডার করুন",
            subheading: "ফর্ম পূরণ করুন, আমরা দ্রুত কনফার্ম করব।",
            ctaLabel: "",
            whatsappNumber: "",
          }
        : {}),
      ...(isRoot ? { main: [], sidebar: [] } : {}),
      ...(HAS_HEADING.has(name) ? { heading: "" } : {}),
      ...(name === "CheckoutPlaceOrder" ? { ctaLabel: "" } : {}),
    },
    /**
     * Props are picked out explicitly, never spread.
     *
     * Puck hands a block its slot props as COMPONENTS (functions) plus its own
     * `puck` helpers. Passing any of those into a client component throws
     * "Functions cannot be passed directly to Client Components" and 500s the
     * page. Slots are therefore rendered here, on the server, and handed
     * across as elements — which the boundary does allow.
     */
    render: (props: CheckoutSlotProps) => {
      const {
        main,
        sidebar,
        heading,
        ctaLabel,
        productSlug,
        subheading,
        whatsappNumber,
        showImage,
      } = props as {
          main?: React.ComponentType;
          sidebar?: React.ComponentType;
          heading?: unknown;
          ctaLabel?: unknown;
          productSlug?: unknown;
          subheading?: unknown;
          whatsappNumber?: unknown;
          showImage?: unknown;
        };
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      const Main = main;
      const Sidebar = sidebar;
      return (
        <CheckoutSlot
          name={name}
          heading={str(heading)}
          ctaLabel={str(ctaLabel)}
          productSlug={str(productSlug)}
          subheading={str(subheading)}
          whatsappNumber={str(whatsappNumber)}
          showImage={str(showImage)}
          main={Main ? <Main /> : null}
          sidebar={Sidebar ? <Sidebar /> : null}
        />
      );
    },
  };
}

export const checkoutBlocks: Config["components"] = Object.fromEntries(
  CHECKOUT_BLOCK_NAMES.map((name) => [name, makeBlock(name)]),
) as Config["components"];
