import type { WhatsappConfig } from "@/lib/whatsapp";

const phoneIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 shrink-0">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// One of the 4 CTA-grid cells in PdpPurchasePanel — present on every product
// page (alongside WhatsApp) regardless of stock status.
//
// Prefers the dedicated call number from Contact Buttons settings, falling
// back to the WhatsApp number, which is what this used before that setting
// existed. The two are formatted differently on purpose: the WhatsApp number
// is stored international-without-+ so it needs one prepending, while the
// call number is dialled exactly as an admin typed it (local 01XXXXXXXXX is
// normal here).
export function CallNowButton({ config }: { config: WhatsappConfig | null }) {
  if (!config) return null;
  if (config.callEnabled === false) return null;

  const href = config.callNumber
    ? `tel:${config.callNumber}`
    : config.phoneNumber
      ? `tel:+${config.phoneNumber}`
      : null;
  if (!href) return null;

  return (
    <a
      href={href}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-5 font-ui text-sm font-semibold capitalize text-white transition-colors hover:bg-[#16296b]"
    >
      {phoneIcon}
      Call Now
    </a>
  );
}
