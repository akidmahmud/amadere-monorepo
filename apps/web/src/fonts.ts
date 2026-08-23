import localFont from "next/font/local";

// Self-hosted, not the earlier Google-Fonts-CDN "Google Sans Flex" —
// explicit request to standardize the whole storefront on this exact
// typeface (see fonts/OFL.txt for the license). Variable font (GRAD/opsz/
// wght axes), so these two files alone cover every weight/style instead of
// needing a static file per weight. `variable` publishes it as a CSS custom
// property that tokens.css's --font-* tokens read, with a fallback to the
// old 'Google Sans Flex' for apps that don't apply this class (apps/admin) —
// see tokens.css's own comment.
//
// WOFF2, not the original .ttf. The upstream release ships raw TrueType
// (4.56 MB + 4.85 MB); next/font/local does NOT subset or re-compress, it
// serves whatever file it's pointed at, and it emits a `rel=preload` Link
// header for each one — so every single page view was pulling ~4.5 MB of
// font at top priority before anything else could finish (measured: 2107 KB
// + 2382 KB over the wire, gzip being about all a .ttf will give you). On
// mobile data that alone put full page load at ~40s.
//
// These .woff2 files are the same variable fonts, subset to the character
// set this storefront actually renders (Latin + Latin Ext A/B, combining
// diacriticals, the full Bengali block U+0980-09FF including the taka sign
// ৳, general punctuation, currency, arrows, math, and the ★/✓/• symbol
// ranges used by RatingStars/PdpPurchasePanel/the FAQ CSS) and converted to
// WOFF2. All three variable axes (opsz 17-18, wght 400-700, GRAD -50-200)
// are preserved, so nothing about how the type renders changes — 241 KB and
// 268 KB respectively, ~95% smaller.
//
// Regenerate with fonttools if the glyph set ever needs widening:
//   pyftsubset GoogleSans-Variable.ttf \
//     --unicodes='U+0000-00FF,U+0100-017F,U+0180-024F,U+0250-02AF,U+0300-036F,U+0980-09FF,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2600-26FF,U+2700-27BF,U+FE00-FE0F,U+FEFF' \
//     --layout-features='*' --flavor=woff2 --output-file=GoogleSans-Variable.woff2
// `--layout-features='*'` matters: dropping it strips the Bengali shaping
// features (akhn/blwf/half/pstf/vatu/cjct/rphf/…) and conjuncts stop
// forming. The original .ttf files are kept in this folder as the source to
// re-subset from; nothing imports them, so they aren't shipped.
export const googleSans = localFont({
  src: [
    {
      path: "./fonts/GoogleSans-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

// Split out and NOT preloaded, deliberately.
//
// next/font/local preloads every face in a `src` array, so declaring italic
// alongside normal meant a 269 KiB italic file was fetched at high priority
// on every page view. Measured on the live site it was the single largest
// first-party resource — larger than any JavaScript chunk, and larger than
// the normal weight it sits next to.
//
// Italic is used in exactly one place site-wide: the FAQ answer paragraphs
// (globals.css `.amader-faq .faq-answer p`). That rule points at
// --font-google-sans-italic, so the file is fetched only on pages that
// actually render it, and `display: swap` means the text is visible in the
// upright face meanwhile.
export const googleSansItalic = localFont({
  src: [
    {
      path: "./fonts/GoogleSans-Variable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-google-sans-italic",
  display: "swap",
  preload: false,
});
