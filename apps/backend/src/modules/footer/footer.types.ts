import type { FooterAppStyle, FooterSocialIcon } from '@amader/shared';

/** Every admin-editable text field carries both locales. Both keys are
 * required — an empty string is a deliberate blank, a missing key is a bug. */
export interface Translated {
  en: string;
  bn: string;
}

export interface FooterLink {
  label: Translated;
  href: string;
  newTab: boolean;
}

export interface FooterColumn {
  heading: Translated;
  links: FooterLink[];
}

export interface FooterSocialLink {
  icon: FooterSocialIcon;
  /** Set only when icon === 'custom'. */
  mediaId: number | null;
  url: string;
  /** Becomes the anchor's aria-label. */
  label: Translated;
}

export interface FooterAppButton {
  style: FooterAppStyle;
  /** Set only when style === 'custom'. */
  mediaId: number | null;
  /** Empty renders an inert button rather than hiding it. */
  url: string;
  lineOne: Translated;
  lineTwo: Translated;
}

/** Address and hours are prose, so their values translate. Phone and email
 * are single ASCII strings because they become tel:/mailto: targets. */
export interface FooterContact {
  address: { label: Translated; value: Translated };
  phone: { label: Translated; value: string };
  email: { label: Translated; value: string };
  hours: { label: Translated; value: Translated };
}

export interface FooterConfig {
  brandMark: Translated;
  description: Translated;
  contact: FooterContact;
  social: FooterSocialLink[];
  apps: { downloadLabel: Translated; buttons: FooterAppButton[] };
  columns: FooterColumn[];
  payment: { label: Translated; mediaId: number | null };
  copyright: Translated;
  /** Footer-specific logo. Null means "use the site logo" — the footer showed
   * the site logo before this field existed, so null preserves that. */
  logo: { mediaId: number | null };
}
