import { Prisma } from '@amader/db';
import { resolveZoneFee } from '../../shipping-zones/shipping-zones.matcher';
import { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';

const Decimal = Prisma.Decimal;

export interface VatSettings {
  enabled: boolean;
  ratePercent: number;
  binNumber: string;
}

// 15% is the standard NBR VAT rate for most goods in Bangladesh — a sane
// e-commerce default, editable per-store in Settings. Exported so
// CheckoutService can apply the exact same rate to real orders instead of
// this being a reporting-only figure divorced from what customers actually
// pay (see checkout.service.ts).
export const VAT_DEFAULTS: VatSettings = { enabled: true, ratePercent: 15, binNumber: '' };

export interface CodFeeSettings {
  enabled: boolean;
  percent: number;
}

// Off by default — a COD surcharge changes what real customers pay, so it
// shouldn't switch on silently the moment this code ships. Admin opts in
// from the same VAT & Cash Flow tab (Settings > Accounts).
export const COD_FEE_DEFAULTS: CodFeeSettings = { enabled: false, percent: 1 };

export interface PostingSettings {
  /**
   * Where prepaid sales and refunds are booked.
   *
   * Null until an admin picks one, and posting is skipped while it is —
   * money must not be booked to an account nobody chose, and guessing (say,
   * the first account by name) would silently put a customer's bKash payment
   * into the wrong balance. A missing setting never fails order processing;
   * it is surfaced as an alert on the Accounts overview instead.
   */
  defaultCashAccountId: number | null;
}

export const POSTING_DEFAULTS: PostingSettings = { defaultCashAccountId: null };

// Checkout-time shipping fee. The Dhaka-vs-everywhere-else split this used
// to hardcode is now admin-editable shipping zones (Shipments > Shipping
// Rates); the shipped defaults reproduce the old 80/120 exactly, so nothing
// changes until an admin edits a zone. This is what's actually charged to
// the customer at order placement; ShipmentsService.dispatch() later
// separately overwrites both shippingAmount and totalAmount with the real
// courier cost (see ShippingChargeCalculator, which does its own similar
// Dhaka-vs-not split for that unrelated number).

// Single source of truth for the shipping-fee math — used by CheckoutService
// when actually placing an order AND by CartService's checkout-preview
// pricing, so what the customer sees on the checkout page can never drift
// from what they're actually charged. `district` is optional because the
// preview can be requested before the customer has typed an address yet;
// resolveZoneFee then quotes the first zone, preserving the old behaviour of
// previewing the cheap Dhaka rate until a real district is known.
//
// `zones` is passed in rather than fetched here so this stays a pure,
// directly-testable function — the callers own the DB read.
//
// Lives in this constants file rather than in a service because it is pure
// and is imported by cart and checkout; the accounts services around it are
// Nest providers those modules have no reason to depend on.
//
// `ruleOverride` is the courier rate card (Shipments > Shipping Rules) when
// its "charge this at checkout" toggle is ON. It is resolved by the caller
// because it needs the parcel weight, which means DB reads this pure
// function must not do. Null — the toggle is off, or no rule matched the
// district — means keep quoting the zones, never means free.
export function computeCheckoutFees(
  freeShipping: boolean,
  district: string | undefined,
  zones: ShippingZonesConfig,
  ruleOverride?: Prisma.Decimal | null,
): { shippingFee: Prisma.Decimal } {
  if (freeShipping) return { shippingFee: new Decimal(0) };
  if (ruleOverride) return { shippingFee: ruleOverride };
  return { shippingFee: new Decimal(resolveZoneFee(zones, district).fee) };
}
