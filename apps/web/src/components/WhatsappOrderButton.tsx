import { buildWhatsappLink, fillTemplate } from "@/lib/whatsapp";
import type { WhatsappConfig } from "@/lib/whatsapp";

const whatsappIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5 shrink-0">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.25.85 5.79 2.4a8.2 8.2 0 0 1 2.42 5.84c0 4.55-3.71 8.25-8.26 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.39c0-4.55 3.71-8.24 8.29-8.24Zm-4.5 4.66c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.71 4.24 3.7 2.1.82 2.53.66 2.99.62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.48-.73-1.71-.82-.23-.08-.4-.12-.56.13-.16.24-.64.81-.79.98-.15.16-.29.19-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.37-.77-1.87-.2-.48-.4-.42-.56-.42h-.44Z" />
  </svg>
);

// `config` comes from the server (product page's own safeGet call, same
// pattern as AnalyticsScripts) rather than a client-side useQuery — the
// button's presence depends on admin-configured data unavailable during
// SSR, and fetching it client-side caused a real hydration mismatch (server
// renders null, client's first paint already had the cached button).
//
// "icon" is the small always-present circular button next to the wishlist
// heart (in-stock state). "block" is the full-width labeled CTA shown in
// place of the (disabled) Add to Cart/Buy Now buttons once a product is out
// of stock — same link, just a different affordance for a different moment.
export function WhatsappOrderButton({
  config,
  productName,
  variant = "icon",
}: {
  config: WhatsappConfig | null;
  productName: string;
  variant?: "icon" | "block";
}) {
  if (!config?.enabled || !config.phoneNumber) return null;

  const message = fillTemplate(config.productMessageTemplate, { productName });
  const href = buildWhatsappLink(config.phoneNumber, message);

  if (variant === "block") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#25D366] px-5 py-2.5 font-ui text-sm font-medium text-white transition-colors hover:bg-[#1ebe5b]"
      >
        {whatsappIcon}
        Order via WhatsApp
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-[#25D366] hover:bg-[#25D366]/10"
      aria-label="Order on WhatsApp"
      title="Order on WhatsApp"
    >
      {whatsappIcon}
    </a>
  );
}
