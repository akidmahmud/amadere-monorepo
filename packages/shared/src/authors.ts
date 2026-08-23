import { FOOTER_SOCIAL_ICONS, type FooterSocialIcon } from './footer';

// Authors reuse the FOOTER's admin-managed icon vocabulary rather than
// defining a second one — same glyph map in @amader/ui, same names in the
// admin dropdown, so adding an icon stays a single edit in footer.ts.
// `custom` is deliberately excluded here: the footer renders a custom icon
// from an uploaded image, and an author card has no equivalent upload slot.
export const AUTHOR_SOCIAL_ICONS = FOOTER_SOCIAL_ICONS.filter(
  (icon): icon is Exclude<FooterSocialIcon, 'custom'> => icon !== 'custom',
);

export type AuthorSocialIcon = (typeof AUTHOR_SOCIAL_ICONS)[number];

export interface AuthorSocialLink {
  icon: AuthorSocialIcon;
  url: string;
  /** Accessible name for the icon link — falls back to the icon name. */
  label?: string;
}

// A bound against a malformed payload rendering a wall of icons, not a
// product limit — same rationale as FOOTER_MAX_SOCIAL.
export const AUTHOR_MAX_SOCIAL = 8;
