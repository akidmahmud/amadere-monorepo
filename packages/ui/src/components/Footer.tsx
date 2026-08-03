"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface FooterLinkColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface FooterProps {
  brandMark: string;
  logoUrl?: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  facebookHref?: string;
  instagramHref?: string;
  youtubeHref?: string;
  googlePlayHref?: string;
  appStoreHref?: string;
  appDownloadLabel: string;
  columns: FooterLinkColumn[];
  copyrightLabel: string;
  payWithLabel: string;
  /** Single banner image (payment method logos + payment-gateway badge, same
   * as ghorerbazar.com's own `.footer-payment-img` — one image, not
   * individually-rendered icons) — a placeholder renders until this is set. */
  paymentImageUrl?: string;
  linkComponent?: LinkComponent;
}

const pinIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-header-green">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const phoneIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-header-green">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const mailIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-header-green">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const facebookIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7Z" />
  </svg>
);
const instagramIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const youtubeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
  </svg>
);
const googlePlayIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
    <path d="M4 3.5v17c0 .4.5.7.9.4l13.6-8.1c.4-.2.4-.8 0-1L4.9 3.1c-.4-.2-.9 0-.9.4Z" />
  </svg>
);
const appStoreIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
    <path d="M16.5 3c.1 1-.3 2-.9 2.7-.6.7-1.6 1.3-2.6 1.2-.1-1 .4-2 1-2.6.6-.7 1.7-1.2 2.5-1.3ZM19.9 17c-.5 1.1-.7 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.5-3.7-2.9C1.2 16.1.9 11.4 2.6 8.9c1.1-1.8 2.9-2.8 4.6-2.8 1.7 0 2.8 1 4.2 1 1.4 0 2.2-1 4.2-1 1.5 0 3.1.8 4.2 2.2-3.7 2-3.1 7.2.1 8.7Z" />
  </svg>
);

// Pixel-matched to ghorerbazar.com's `footer.style-3`: a 2-column grid for
// the four link columns on mobile (About spans both, matching the
// reference's col-6 tiles), one unified row at lg (About wider + 4 link
// columns), and a payment-banner + copyright bottom bar that stacks
// (payment banner on top, centered) on mobile and sits side-by-side on
// desktop — all measured directly against the reference.
export function Footer({
  brandMark,
  logoUrl,
  description,
  address,
  phone,
  email,
  facebookHref,
  instagramHref,
  youtubeHref,
  googlePlayHref,
  appStoreHref,
  appDownloadLabel,
  columns,
  copyrightLabel,
  payWithLabel,
  paymentImageUrl,
  linkComponent: Link = DefaultLink,
}: FooterProps) {
  return (
    <footer className="border-t border-header-line bg-white">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-4 pb-10 md:py-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:gap-x-8">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandMark} className="h-12 w-auto" />
              ) : (
                <span className="font-bengali text-2xl font-bold text-header-green">{brandMark}</span>
              )}
            </Link>
            <p className="max-w-[425px] font-header text-sm leading-[1.5] text-header-muted">{description}</p>
            <ul className="mt-5 flex flex-col gap-2.5">
              <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                {pinIcon}
                {address}
              </li>
              <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                {phoneIcon}
                {phone}
              </li>
              <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                {mailIcon}
                {email}
              </li>
            </ul>
            <div className="mt-5 flex gap-2">
              {facebookHref && (
                <a href={facebookHref} aria-label="Facebook" className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-header-green text-header-green transition-colors hover:bg-header-green hover:text-white">
                  {facebookIcon}
                </a>
              )}
              {instagramHref && (
                <a href={instagramHref} aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-header-green text-header-green transition-colors hover:bg-header-green hover:text-white">
                  {instagramIcon}
                </a>
              )}
              {youtubeHref && (
                <a href={youtubeHref} aria-label="YouTube" className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-header-green text-header-green transition-colors hover:bg-header-green hover:text-white">
                  {youtubeIcon}
                </a>
              )}
            </div>
            {(googlePlayHref || appStoreHref) && (
              <>
                <div className="mt-6 font-header text-base font-medium text-header-ink">{appDownloadLabel}</div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {googlePlayHref && (
                    <a href={googlePlayHref} aria-label="Get it on Google Play" className="inline-flex h-11 items-center gap-[9px] rounded-lg bg-[#111] px-3.5 text-white">
                      {googlePlayIcon}
                      <span className="leading-[1.15]">
                        <span className="block text-[0.55rem] font-medium opacity-85">GET IT ON</span>
                        <span className="block font-header text-[0.82rem] font-bold">Google Play</span>
                      </span>
                    </a>
                  )}
                  {appStoreHref && (
                    <a href={appStoreHref} aria-label="Download on the App Store" className="inline-flex h-11 items-center gap-[9px] rounded-lg bg-[#111] px-3.5 text-white">
                      {appStoreIcon}
                      <span className="leading-[1.15]">
                        <span className="block text-[0.55rem] font-medium opacity-85">Download on the</span>
                        <span className="block font-header text-[0.82rem] font-bold">App Store</span>
                      </span>
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h4 className="mb-4 font-header text-base font-medium text-header-ink">{column.heading}</h4>
              <ul className="flex flex-col gap-1 md:gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-header text-sm leading-none text-header-muted transition-colors hover:text-header-green md:leading-normal">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse items-center gap-3 border-t border-header-line py-4 text-center md:flex-row md:justify-between md:py-6 md:text-left">
          <div className="font-header text-sm text-header-muted">{copyrightLabel}</div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="font-header text-sm font-medium text-header-ink">{payWithLabel}</span>
            {paymentImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paymentImageUrl} alt={payWithLabel} className="h-[58px] w-auto max-w-[359px] object-contain md:h-[80px] md:max-w-[500px]" />
            ) : (
              <div className="flex h-[58px] w-[220px] items-center justify-center rounded border border-dashed border-header-line text-center font-header text-xs text-header-muted md:h-[80px] md:w-[400px]">
                Payment methods placeholder
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
