// The site-wide rich text editor's (CKEditor 5) Font Family picker needs the
// exact same family list in two unrelated places: the Google Fonts <link>
// both apps/admin and apps/web load in their root layouts (so a picked font
// actually renders as that typeface, not a silent fallback — see those
// layout.tsx files), and CKEditor's own `fontFamily.options` config. Kept
// here as one shared list so the two can never drift apart — a font in the
// picker that isn't also loaded via the link would silently do nothing.
export interface CkeditorFontFamily {
  /** Google Fonts family name, spaces as literal spaces (not "+"). */
  name: string;
  /** Comma-separated `wght@` values for the Google Fonts CSS2 API. */
  weights: string;
  fallback: "sans-serif" | "serif" | "monospace";
}

// Curated, not exhaustive — every English weight-category (sans/serif/mono)
// plus every commonly-used Bangla Google Font, so there's real variety
// without loading dozens of near-duplicate typefaces on every page view.
export const CKEDITOR_FONT_FAMILIES: CkeditorFontFamily[] = [
  { name: "Inter", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Poppins", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Plus Jakarta Sans", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Roboto", weights: "400;500;700", fallback: "sans-serif" },
  { name: "Open Sans", weights: "400;500;600;700;800", fallback: "sans-serif" },
  { name: "Lato", weights: "400;700", fallback: "sans-serif" },
  { name: "Montserrat", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Nunito", weights: "400;600;700", fallback: "sans-serif" },
  { name: "Fraunces", weights: "400;500;600;700", fallback: "serif" },
  { name: "Playfair Display", weights: "400;600;700", fallback: "serif" },
  { name: "Merriweather", weights: "400;700", fallback: "serif" },
  { name: "Lora", weights: "400;600;700", fallback: "serif" },
  { name: "Roboto Mono", weights: "400;500", fallback: "monospace" },
  { name: "Hind Siliguri", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Noto Sans Bengali", weights: "400;500;600;700", fallback: "sans-serif" },
  { name: "Noto Serif Bengali", weights: "400;600;700", fallback: "serif" },
  { name: "Baloo Da 2", weights: "400;600;700", fallback: "sans-serif" },
  { name: "Tiro Bangla", weights: "400", fallback: "serif" },
  { name: "Anek Bangla", weights: "400;500;600;700", fallback: "sans-serif" },
];

export function ckeditorGoogleFontsUrl(): string {
  const families = CKEDITOR_FONT_FAMILIES.map(
    (f) => `family=${f.name.replace(/ /g, "+")}:wght@${f.weights}`,
  ).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// System fonts need no loading at all; the rest come from CKEDITOR_FONT_FAMILIES.
export function ckeditorFontFamilyOptions(): string[] {
  return [
    "default",
    "Arial, Helvetica, sans-serif",
    "Georgia, 'Times New Roman', serif",
    "'Courier New', Courier, monospace",
    ...CKEDITOR_FONT_FAMILIES.map((f) => `'${f.name}', ${f.fallback}`),
  ];
}
