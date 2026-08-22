// Shared by the backend DTO (validation), the admin icon dropdown, and the
// @amader/ui glyph map — one list, so adding an icon is a single edit.
export const FOOTER_SOCIAL_ICONS = [
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'whatsapp',
  'linkedin',
  'x',
  'telegram',
  'pinterest',
  'custom',
] as const;

export type FooterSocialIcon = (typeof FOOTER_SOCIAL_ICONS)[number];

export const FOOTER_APP_STYLES = ['googlePlay', 'appStore', 'custom'] as const;

export type FooterAppStyle = (typeof FOOTER_APP_STYLES)[number];

// Bounds against a malformed payload rendering a wall of icons — not product
// limits. The column cap is real though: the footer grid has four widths.
export const FOOTER_MAX_COLUMNS = 4;
export const FOOTER_MAX_SOCIAL = 10;
export const FOOTER_MAX_APP_BUTTONS = 4;

// Exported from one place so the write-side DTO (update-footer.dto.ts) and
// the read-side merge (footer.service.ts) cannot drift apart — the DTO is
// not the only write path into `footer_config` (the generic admin settings
// endpoint can also write this key), so the read boundary re-checks these
// same rules rather than trusting that every writer validated.
//
// A site-relative path or an absolute http(s) URL. Deliberately excludes
// javascript: and data: — these strings land in an href rendered on every
// page, and the admin panel is not the only thing that writes settings.
// The relative branch also rejects a second leading `/` or a `\` right
// after the first `/` — browsers treat `//evil.example/x` and `/\evil.example`
// as protocol-relative offsite URLs, not site-relative paths.
export const FOOTER_HREF_PATTERN = /^(\/(?!\/|\\)[^\s]*|https?:\/\/[^\s]+)$/;

// Social/app-button urls must be an absolute http(s) URL, or empty (an app
// button and a social entry both stay visible with an empty url — see
// footer.defaults.ts / Footer.tsx).
export const FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN = /^(|https?:\/\/[^\s]+)$/;
