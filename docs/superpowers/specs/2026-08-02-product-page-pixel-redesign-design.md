# Product Page Pixel-Perfect Redesign — Design Spec

**Goal:** Rebuild the storefront product detail page (`apps/web`'s `/products/[slug]`)
to match `https://ghorerbazar.com/products/black-seed-honey-1kg` pixel-for-pixel —
layout, spacing, colors, typography, on both desktop and mobile — while retaining a
short list of existing features the client wants kept, and removing sections that
have no equivalent on the reference page. The current product-page design system
(the one built from earlier "doc 1.4" work) is being fully abandoned for this page;
this is not an incremental tweak.

**Why:** The client rejected the current product page design. Rather than iterate
on it again, the direction is to copy a specific reference page's design exactly,
changing shared/reusable components where needed to achieve that, and to stop
treating the old design system as the source of truth for this page.

## Reference

Live reference: `https://ghorerbazar.com/products/black-seed-honey-1kg`
(a competitor site, not owned by this project — used purely as a visual spec).

## Scope

In scope: `apps/web/src/app/[locale]/products/[slug]/page.tsx`, `PdpPurchasePanel.tsx`,
`WhatsappOrderButton.tsx`, `CallNowButton.tsx`, and the `@amader/ui` components this
page uses (`ProductGallery`, `ProductTabs`, `PriceTag`, `QtyStepper`,
`PackSizeSelector`, `ProductComparisonTable`, `WatchingNowBadge`, `RatingStars`,
`Button`). No other page type, and no site-wide chrome (header/nav/footer/cart
drawer), is touched by this work.

`ProductTabs` is currently used ONLY by this page (confirmed via grep across
`apps/web` and `apps/admin` — the admin app has an unrelated same-named component in
a different package). It can be restyled in place with no risk to other consumers.
`ComboCard` (used for the "Frequently Bought Together" block being removed here) is
also used on the homepage and `/combos` page — only this page's usage is deleted,
the component itself is untouched.

## Page structure (top to bottom)

1. Breadcrumb — unchanged.
2. **Hero card**: gallery (thumbnail column + main image, side-by-side even on
   mobile — confirmed the reference keeps this layout down to 390px width, no
   stacking) + buy panel (title, price, `<hr>`, quantity row, 2×2 CTA button grid,
   Brand pill, viewing-now badge). See "Hero card" section below for exact values.
3. **Tab strip**: Description / Key Benefits / How to Use — restyled to the
   reference's pill-tab look. Same three tabs as today, same content, visual-only
   change.
4. **"About This Product" section — deleted.** This was a duplicate rendering of
   `product.description` below the hero card; the reference page has no equivalent
   separate section (the description only lives inside the Description tab).
5. **Comparison Table** — kept, restyled to fit the new page's visual language.
   Logic unchanged (still only renders when an admin has filled in comparison
   rows).
6. **Related Products** — converted from `ProductCarouselSectionClient` (auto-play
   carousel) to a static grid (reference shows exactly 5 cards, no slider arrows)
   with a "More Products →" link in the section header, linking to
   `/categories/{category.slug}` (or `/products` if the item has no category).
7. **Customer Reviews** — stays a separate section below Related Products (not
   folded into the tab strip — confirmed with the user). Restyled to match the
   reference's rating-breakdown-bar layout above the write-review form.
8. **Frequently Bought Together (combos) — deleted.** The reference page has no
   equivalent section. `ComboCard` and the combos API call are removed from this
   page only.

## Confirmed pixel values (measured live against the reference via computed styles)

These are real, not estimated — pulled directly from the reference page's computed
styles/bounding rects. Anywhere this spec doesn't give an exact number, the
implementer must measure it live against the reference the same way (see
"Verification" below) rather than eyeballing it from a screenshot.

**Typography**: reference page body font is `"Open Sans", sans-serif`. Match this
font on the PDP-specific text this spec calls out below (title, price, buttons,
tabs, labels) — do not attempt to reflow the rest of the site to Open Sans.

- Title (`h1`): color `#222831`, 24px, weight 500, letter-spacing -0.6px,
  margin-bottom 16px.
- Price: color `#F48721`, 26px, weight 600, letter-spacing -1.3px.
- Add to Cart button: bg `#F48721`, text white, 14px/600, uppercase, radius 6px,
  padding 12px, size 300×44 (desktop, in a 2-col grid with 12px gap).
- Buy Now button: bg `#041F1E`, text white, same sizing/typography as Add to Cart.
- Order On WhatsApp button: bg `#1DAA61`, text white, radius **8px** (not 6px),
  padding 8px, text-transform **capitalize** (not uppercase) — this differs from
  the Add to Cart/Buy Now pair, don't copy their uppercase styling onto this one.
- Call For Order button: bg `#1E3A8A`, text white, radius 8px, padding 8px,
  capitalize — same shape family as WhatsApp, distinct color.
- CTA grid: `display: grid`, `gap: 12px`, 2 equal columns on desktop
  (300.4px each at 1440px viewport width) — confirm actual column behavior at your
  target breakpoints since this is a computed pixel width, not a fixed one.
- Tabs (inactive): bg `#F5F5F5`, text `#666666`, radius 4px, padding `12px 24px`,
  14px/600, text-transform capitalize.
- Tabs (active): bg `#F48721`, text white, same sizing as inactive.
- Hero card container: white background, border-radius 12px,
  box-shadow `0 2px 4px rgba(0,0,0,0.11)`, padding 24px. **This already matches
  the current codebase** (a prior pass already measured and applied this exact
  value) — verify it's still correct rather than re-deriving it, don't regress it.

## Retained features (do not drop these during the rewrite)

1. **Quantity picker** — keep `QtyStepper`'s current min/max/onChange behavior
   exactly as-is; only restyle its box to match the reference's stepper look
   (bordered pill, `−` / number / `+`).
2. **"Viewing now" badge** (`WatchingNowBadge`) — keep the component and its data
   behavior unchanged. Reposition it: the reference page has no equivalent widget
   at all, so per the client's direction it moves to sit near the Brand pill,
   below the CTA button grid (not in its current spot between the description and
   the purchase panel).
3. **Tabbed content** — Description / Key Benefits / How to Use stay as three
   separate tabs (via `ProductTabs`), just restyled to the reference's pill look.
   Reviews stay a separate section, not a fourth tab (explicit decision — the
   reference treats reviews as a tab, but this project keeps its current
   information architecture there).
4. **Mobile pack-size dropdown** — the existing `<select>` shown on mobile in
   `PdpPurchasePanel.tsx` (the inline stand-in for the desktop `PackSizeSelector`
   card grid) keeps its current markup/behavior untouched. It is not being
   redesigned to match anything on the reference site.

## Removed features

- "About This Product" section (duplicate description block below the hero card).
- "Frequently Bought Together" combos carousel.
- (Comparison Table and Reviews are *not* removed — see Page Structure above.)

## Desktop vs. mobile

- Gallery stays side-by-side (thumbnail column + main image) at every breakpoint,
  including mobile — pixel-matching the reference rather than switching to a
  stacked mobile pattern.
- CTA button grid: reference uses a 2-column grid at desktop width; confirm via
  live measurement whether the reference collapses this to a single column at
  phone widths, and match whatever it actually does — don't assume.
- Everything else in "Confirmed pixel values" applies at both breakpoints unless
  live measurement of the reference at mobile width shows a different value.

## Verification

Per this project's existing convention (already used elsewhere in this codebase,
e.g. the hero card's shadow/radius/padding values), pixel accuracy is checked by
measuring the *live reference page*, not by eyeballing screenshots:

- For every section touched, capture the reference's computed styles
  (`getComputedStyle`) and bounding rects (`getBoundingClientRect`) for the
  relevant elements — margins, padding, gaps, font sizes, colors, border-radius,
  box-shadow — at both a desktop viewport (1440px was used for this spec's
  measurements) and a mobile viewport (390px).
- Build the corresponding section in this codebase, then re-measure the built
  version the same way and diff the numbers against the reference.
- Take side-by-side screenshots (reference vs. built) at both breakpoints as the
  final check before calling a section done.
- `pnpm -r exec tsc --noEmit` after the page compiles, same as this project's
  standard practice.
- No backend/schema changes are involved in this spec — it's presentation-only,
  so no API or data-flow verification is needed beyond confirming existing props
  (e.g. `product.comparisonTable`, `product.benefitPoints`) still flow through
  correctly after the JSX restructure.
