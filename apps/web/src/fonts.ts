import localFont from "next/font/local";

// Self-hosted, not the earlier Google-Fonts-CDN "Google Sans Flex" —
// explicit request to standardize the whole storefront on this exact
// typeface (see fonts/OFL.txt for the license). Variable font (GRAD/opsz/
// wght axes), so these two files alone cover every weight/style instead of
// needing a static file per weight. `variable` publishes it as a CSS custom
// property that tokens.css's --font-* tokens read, with a fallback to the
// old 'Google Sans Flex' for apps that don't apply this class (apps/admin) —
// see tokens.css's own comment.
export const googleSans = localFont({
  src: [
    { path: "./fonts/GoogleSans-Variable.ttf", weight: "100 900", style: "normal" },
    { path: "./fonts/GoogleSans-Variable-Italic.ttf", weight: "100 900", style: "italic" },
  ],
  variable: "--font-google-sans",
  display: "swap",
});
