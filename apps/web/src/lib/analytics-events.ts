import { getUtmParams } from "@/lib/utm";

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
  }
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
