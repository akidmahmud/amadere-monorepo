"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { SOCIAL_ICONS, socialFallbackIcon } from "./SocialIcon";

export interface FooterLinkColumn {
  heading: string;
  links: { label: string; href: string; newTab?: boolean }[];
}

export interface FooterSocialLink {
  /** A key in SOCIAL_ICONS, or 'custom' to render `imageUrl` instead. */
  icon: string;
  imageUrl?: string | null;
  url: string;
  label: string;
}

export interface FooterAppButton {
  /** 'googlePlay' | 'appStore' | 'custom'. */
  style: string;
  imageUrl?: string | null;
  /** Empty renders an inert button — see the comment at its render site. */
  url: string;
  lineOne: string;
  lineTwo: string;
}

export interface FooterProps {
  brandMark: string;
  logoUrl?: string;
  /** Rich text (HTML) authored in the admin's CKEditor. **Callers MUST
   * sanitize this before passing it** — it is rendered with
   * dangerouslySetInnerHTML. apps/web does so in SiteFooter via
   * sanitizeHtml(). Plain text passes through unharmed. */
  description: string;
  address: string;
  phone: string;
  phoneHref?: string;
  email?: string;
  emailHref?: string;
  workingHours?: string;
  social: FooterSocialLink[];
  appButtons: FooterAppButton[];
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
const clockIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-header-green">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

// Neutral globe/link glyph for an app button whose style is `custom` with no
// imageUrl, or a style absent from APP_ICONS. Sized 20px to match the other
// app-button glyphs; the 16px social equivalent lives in ./SocialIcon.
const appFallbackIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);


const APP_ICONS: Record<string, React.ReactNode> = {
  googlePlay: googlePlayIcon,
  appStore: appStoreIcon,
};

const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-[1.6fr_1fr]",
  2: "lg:grid-cols-[1.6fr_1fr_1fr]",
  3: "lg:grid-cols-[1.6fr_1fr_1fr_1fr]",
  4: "lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]",
};

export function Footer({
  brandMark,
  logoUrl,
  description,
  address,
  phone,
  phoneHref,
  email,
  emailHref,
  workingHours,
  social,
  appButtons,
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
        <div className={`grid grid-cols-2 gap-x-6 gap-y-10 py-4 pb-10 md:py-8 lg:gap-x-8 ${GRID_COLS[Math.min(Math.max(columns.length, 1), 4)]}`}>
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy" src={logoUrl} alt={brandMark} className="h-12 w-auto" />
              ) : (
                <span className="font-bengali text-2xl font-bold text-header-green">{brandMark}</span>
              )}
            </Link>
            {/* eslint-disable-next-line react/no-danger -- admin-authored rich
                text; sanitized by the caller, see the prop's doc comment. */}
            <div
              className="footer-description max-w-[425px] font-header text-sm leading-[1.6] text-header-muted"
              dangerouslySetInnerHTML={{ __html: description }}
            />
            <ul className="mt-5 flex flex-col gap-2.5">
              <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                {pinIcon}
                {address}
              </li>
              <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                {phoneIcon}
                {phoneHref ? (
                  <a href={phoneHref} className="transition-colors hover:text-header-green">
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </li>
              {email && (
                <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                  {mailIcon}
                  {emailHref ? (
                    <a href={emailHref} className="transition-colors hover:text-header-green">
                      {email}
                    </a>
                  ) : (
                    email
                  )}
                </li>
              )}
              {workingHours && (
                <li className="flex items-center gap-2.5 font-header text-sm text-header-text">
                  {clockIcon}
                  {workingHours}
                </li>
              )}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {social.map((item, index) => {
                const iconContent =
                  item.icon === "custom" && item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy" src={item.imageUrl} alt="" className="h-4 w-4 object-contain" />
                  ) : (
                    SOCIAL_ICONS[item.icon] ?? socialFallbackIcon
                  );
                const className =
                  "grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-header-green text-header-green transition-colors hover:bg-header-green hover:text-white";
                // An empty-url entry stays visible but inert, the same
                // treatment as an app button with no url below: a live
                // `href=""` reloads the current page on click, and it would
                // take keyboard focus for a control that does nothing.
                return item.url ? (
                  <a key={index} href={item.url} aria-label={item.label} className={className}>
                    {iconContent}
                  </a>
                ) : (
                  <span key={index} className={className}>
                    {iconContent}
                  </span>
                );
              })}
            </div>
            {appButtons.length > 0 && (
              <>
                <div className="mt-6 font-header text-base font-medium text-header-ink">{appDownloadLabel}</div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {appButtons.map((button, index) => {
                    const content = (
                      <>
                        {button.style === "custom" && button.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" src={button.imageUrl} alt="" className="h-5 w-5 object-contain" />
                        ) : (
                          APP_ICONS[button.style] ?? appFallbackIcon
                        )}
                        <span className="leading-[1.15]">
                          <span className="block text-[0.55rem] font-medium opacity-85">{button.lineOne}</span>
                          <span className="block font-header text-[0.82rem] font-bold">{button.lineTwo}</span>
                        </span>
                      </>
                    );
                    const className = "inline-flex h-11 items-center gap-[9px] rounded-lg bg-[#111] px-3.5 text-white";
                    // A button with no URL yet still renders — the owner explicitly asked
                    // that these stay visible. It is a span, not href="#": that anchor
                    // scrolls the visitor to the top of the page, and it would take
                    // keyboard focus for a control that does nothing.
                    return button.url ? (
                      <a key={index} href={button.url} aria-label={`${button.lineOne} ${button.lineTwo}`} className={className}>
                        {content}
                      </a>
                    ) : (
                      <span key={index} className={className}>
                        {content}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {columns.map((column, columnIndex) => (
            <div key={columnIndex}>
              <h4 className="mb-4 font-header text-base font-medium text-header-ink">{column.heading}</h4>
              <ul className="flex flex-col gap-1 md:gap-2">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="font-header text-sm leading-none text-header-muted transition-colors hover:text-header-green md:leading-normal"
                    >
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
              <img loading="lazy" src={paymentImageUrl} alt={payWithLabel} className="h-[58px] w-auto max-w-[359px] object-contain md:h-[80px] md:max-w-[500px]" />
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
