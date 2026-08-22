import { Footer } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { components } from "@/lib/api/schema";

type PublicFooter = components["schemas"]["PublicFooterDto"];

export interface SiteFooterProps {
  /** Server-fetched in [locale]/layout.tsx, same as the logo and nav menu —
   * the footer is on every page, so a client-side fetch would mean a visible
   * pop-in on every navigation. */
  footer?: PublicFooter;
  initialLogoUrl?: string | null;
}

// Contact rows are label + value so the phone and email can be real links;
// address and hours have no link target and render as plain text.
function contactLine(label: string, value: string): string {
  return [label, value].filter(Boolean).join(" ");
}

// Predates this feature: the payment strip was always this one static asset
// (see apps/web/public/images/payment-methods-placeholder.png). Now that
// `footer.payment.imageUrl` comes from the backend and is null until an
// admin uploads a payment image, we still need this literal as the fallback
// so a fresh install doesn't show Footer's grey dashed placeholder box.
const DEFAULT_PAYMENT_IMAGE_URL = "/images/payment-methods-placeholder.png";

// Minimal static fallback for when the backend itself was unreachable at
// render time (getPublic() merges over its own defaults for every other
// case, so this branch never fires for an unset or partially-filled
// footer_config — only for a fetch failure). Deliberately not a copy of the
// full defaults document: the goal is "the site still has a footer", not
// "the site has every link", so columns/social/appButtons stay empty and
// contact fields stay blank rather than duplicating footer.defaults.ts here.
const UNREACHABLE_FALLBACK_FOOTER: PublicFooter = {
  brandMark: "আমাদের",
  description: "",
  contact: {
    address: { label: "", value: "" },
    phone: { label: "", value: "" },
    email: { label: "", value: "" },
    hours: { label: "", value: "" },
  },
  social: [],
  apps: { downloadLabel: "", buttons: [] },
  columns: [],
  payment: { label: "", imageUrl: DEFAULT_PAYMENT_IMAGE_URL },
  copyright: `Copyright © ${new Date().getFullYear()} Amader Ltd. All rights reserved.`,
  logo: { imageUrl: null },
};

export function SiteFooter({ footer: footerProp, initialLogoUrl }: SiteFooterProps = {}) {
  // The backend merges over its own defaults, so `footer` is only ever
  // missing when the backend itself was unreachable at render time. The
  // spec requires the footer render defaults rather than drop off the page
  // in that case, so fall back to a minimal static footer instead of null.
  const footer = footerProp ?? UNREACHABLE_FALLBACK_FOOTER;

  return (
    <Footer
      brandMark={footer.brandMark}
      // A footer-specific logo wins; otherwise the site logo, which is what
      // the footer showed before the footer had a logo field of its own.
      logoUrl={footer.logo?.imageUrl ?? initialLogoUrl ?? undefined}
      // Rich text from the admin's CKEditor, rendered by Footer via
      // dangerouslySetInnerHTML — sanitize here, at the trust boundary,
      // exactly as blog/page/product content already does.
      description={sanitizeHtml(footer.description)}
      address={contactLine(footer.contact.address.label, footer.contact.address.value)}
      phone={contactLine(footer.contact.phone.label, footer.contact.phone.value)}
      phoneHref={footer.contact.phone.value ? `tel:${footer.contact.phone.value}` : undefined}
      email={footer.contact.email.value ? contactLine(footer.contact.email.label, footer.contact.email.value) : undefined}
      emailHref={footer.contact.email.value ? `mailto:${footer.contact.email.value}` : undefined}
      workingHours={contactLine(footer.contact.hours.label, footer.contact.hours.value)}
      social={footer.social}
      appButtons={footer.apps.buttons}
      appDownloadLabel={footer.apps.downloadLabel}
      columns={footer.columns}
      copyrightLabel={footer.copyright.replace("{year}", String(new Date().getFullYear()))}
      payWithLabel={footer.payment.label}
      paymentImageUrl={footer.payment.imageUrl ?? DEFAULT_PAYMENT_IMAGE_URL}
      linkComponent={AppLink}
    />
  );
}
