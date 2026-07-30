import type { WhatsappConfig } from "@/lib/whatsapp";

const phoneIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 shrink-0">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// Reuses the WhatsApp settings' phone number — no dedicated "call" number
// config exists yet. One of the 4 CTA-grid cells in PdpPurchasePanel —
// always present on every product page (alongside WhatsApp) regardless of
// stock status.
export function CallNowButton({ config }: { config: WhatsappConfig | null }) {
  if (!config?.phoneNumber) return null;

  const href = `tel:+${config.phoneNumber}`;

  return (
    <a
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-green-deep px-5 py-2 font-ui text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-green-dark md:py-2.5"
    >
      {phoneIcon}
      Call Now
    </a>
  );
}
