import { buildWhatsappLink } from "@/lib/whatsapp";
import type { WhatsappConfig } from "@/lib/whatsapp";

const whatsappIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.25.85 5.79 2.4a8.2 8.2 0 0 1 2.42 5.84c0 4.55-3.71 8.25-8.26 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.39c0-4.55 3.71-8.24 8.29-8.24Zm-4.5 4.66c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.71 4.24 3.7 2.1.82 2.53.66 2.99.62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.48-.73-1.71-.82-.23-.08-.4-.12-.56.13-.16.24-.64.81-.79.98-.15.16-.29.19-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.37-.77-1.87-.2-.48-.4-.42-.56-.42h-.44Z" />
  </svg>
);

// Site-wide floating entry point for general inquiries — the product page's
// own WhatsappOrderButton is the product-specific counterpart to this.
// `config` is fetched server-side (root layout) rather than via a client
// useQuery, same reasoning as WhatsappOrderButton: avoids a hydration
// mismatch between the server's null render and an already-cached client one.
export function WhatsappFloatingButton({ config }: { config: WhatsappConfig | null }) {
  if (!config?.enabled || !config.phoneNumber) return null;

  const href = buildWhatsappLink(config.phoneNumber, config.floatingMessageTemplate);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
    >
      {whatsappIcon}
    </a>
  );
}
