import type { Config } from "@puckeditor/core";
import DOMPurify from "isomorphic-dompurify";
import { SandboxedHtml } from "./SandboxedHtml";
import { InlineHtmlPage } from "./InlineHtmlPage";
import { CHECKOUT_BLOCK_NAMES } from "../../block-names";

/**
 * Content blocks — plan §7.1.
 *
 * Server components: none of these carry "use client", so they render through
 * Puck's RSC `Render` and add no JavaScript to a content page (rule §2.5).
 *
 * Every field has a `defaultProps` entry, so a freshly dragged block shows
 * something rather than an empty box the owner has to guess at.
 *
 * Colours are Tailwind tokens only (`text-ink`, `border-line`, `bg-beige`,
 * `text-green`, `rounded-brand`, ...) — never raw hex — so a builder page
 * cannot drift away from the design system (rule §2.2).
 */

/**
 * Same policy as apps/web's sanitize-html.ts, duplicated here rather than
 * imported because a block may not reach into apps/web (§4 import boundary).
 * Kept deliberately identical: iframes are allowed through because admins
 * hand-author embeds, and DOMPurify still strips event handlers and
 * javascript: URLs on every tag regardless.
 */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
  });
}

/**
 * Checkout blocks are not droppable into content layout slots (plan §7.2
 * step 4). A payment block inside an About page's Section would render its
 * "rendered outside the provider" placeholder at best, and publish-validate as
 * a content page at worst -- easier to forbid the drop than to explain the
 * result.
 */
const NO_CHECKOUT_BLOCKS = { disallow: [...CHECKOUT_BLOCK_NAMES] };

const PAD_Y = {
  none: "py-0",
  sm: "py-6",
  md: "py-10 md:py-14",
  lg: "py-16 md:py-24",
} as const;

const MAX_W = {
  narrow: "max-w-[760px]",
  normal: "max-w-[1100px]",
  wide: "max-w-[1440px]",
  full: "max-w-none",
} as const;

const BG = {
  none: "",
  beige: "bg-beige",
  cream: "bg-cream",
  green: "bg-green text-white",
} as const;

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

type Keys<T> = readonly { label: string; value: keyof T & string }[];
const opts = <T extends object>(o: T): Keys<T> =>
  (Object.keys(o) as (keyof T & string)[]).map((k) => ({
    label: k[0].toUpperCase() + k.slice(1),
    value: k,
  }));

export const contentBlocks: Config["components"] = {
  // ---------------------------------------------------------------- layout
  Section: {
    label: "Section",
    fields: {
      // A slot, not a DropZone zone — see plan §13.3.
      children: { type: "slot", ...NO_CHECKOUT_BLOCKS },
      maxWidth: { type: "select", options: opts(MAX_W) },
      padding: { type: "select", options: opts(PAD_Y) },
      background: { type: "select", options: opts(BG) },
    },
    defaultProps: {
      children: [],
      maxWidth: "normal",
      padding: "md",
      background: "none",
    },
    render: ({ children: Children, maxWidth, padding, background }) => (
      <section className={BG[background as keyof typeof BG] ?? ""}>
        <div
          className={`mx-auto px-4 md:px-6 ${MAX_W[maxWidth as keyof typeof MAX_W] ?? MAX_W.normal} ${
            PAD_Y[padding as keyof typeof PAD_Y] ?? PAD_Y.md
          }`}
        >
          <Children />
        </div>
      </section>
    ),
  },

  Columns: {
    label: "Columns",
    fields: {
      // One slot per column rather than a single slot split by index: Puck
      // addresses slots by prop name, and an index-split slot would reshuffle
      // every column whenever the count changed.
      columnOne: { type: "slot", ...NO_CHECKOUT_BLOCKS },
      columnTwo: { type: "slot", ...NO_CHECKOUT_BLOCKS },
      columnThree: { type: "slot", ...NO_CHECKOUT_BLOCKS },
      columnFour: { type: "slot", ...NO_CHECKOUT_BLOCKS },
      count: {
        type: "select",
        options: [
          { label: "2 columns", value: 2 },
          { label: "3 columns", value: 3 },
          { label: "4 columns", value: 4 },
        ],
      },
      gap: { type: "select", options: opts({ sm: "", md: "", lg: "" }) },
    },
    defaultProps: {
      columnOne: [],
      columnTwo: [],
      columnThree: [],
      columnFour: [],
      count: 2,
      gap: "md",
    },
    render: ({ columnOne: One, columnTwo: Two, columnThree: Three, columnFour: Four, count, gap }) => {
      const n = Number(count) || 2;
      // Stacks to one column below md unconditionally: four columns on a
      // 390px phone is unreadable whatever the desktop choice.
      const cols =
        n === 4
          ? "md:grid-cols-2 lg:grid-cols-4"
          : n === 3
            ? "md:grid-cols-3"
            : "md:grid-cols-2";
      const gapClass = gap === "sm" ? "gap-3" : gap === "lg" ? "gap-10" : "gap-6";
      return (
        <div className={`grid grid-cols-1 ${cols} ${gapClass}`}>
          <div><One /></div>
          <div><Two /></div>
          {n >= 3 && <div><Three /></div>}
          {n >= 4 && <div><Four /></div>}
        </div>
      );
    },
  },

  Spacer: {
    label: "Spacer",
    fields: {
      height: {
        type: "select",
        options: [
          { label: "Extra small (8px)", value: 8 },
          { label: "Small (16px)", value: 16 },
          { label: "Medium (32px)", value: 32 },
          { label: "Large (64px)", value: 64 },
          { label: "Extra large (96px)", value: 96 },
        ],
      },
    },
    defaultProps: { height: 32 },
    // aria-hidden: a spacer is decorative, and an empty div announced by a
    // screen reader is noise.
    render: ({ height }) => (
      <div aria-hidden="true" style={{ height: Number(height) || 32 }} />
    ),
  },

  // ------------------------------------------------------------------ text
  Heading: {
    label: "Heading",
    fields: {
      text: { type: "text" },
      level: {
        type: "select",
        options: [
          { label: "H1", value: 1 },
          { label: "H2", value: 2 },
          { label: "H3", value: 3 },
          { label: "H4", value: 4 },
        ],
      },
      align: { type: "select", options: opts(ALIGN) },
    },
    defaultProps: { text: "Heading", level: 2, align: "left" },
    render: ({ text, level, align }) => {
      const n = Math.min(4, Math.max(1, Number(level) || 2));
      const Tag = `h${n}` as "h1" | "h2" | "h3" | "h4";
      const size =
        n === 1
          ? "text-[28px] md:text-[40px]"
          : n === 2
            ? "text-[22px] md:text-[30px]"
            : n === 3
              ? "text-[18px] md:text-[24px]"
              : "text-[16px] md:text-[19px]";
      return (
        <Tag
          className={`font-serif font-semibold text-green ${size} ${
            ALIGN[align as keyof typeof ALIGN] ?? ALIGN.left
          }`}
        >
          {String(text ?? "")}
        </Tag>
      );
    },
  },

  RichText: {
    label: "Rich text",
    fields: {
      // Textarea, not Puck 0.23's built-in richtext field: this block is the
      // migration target for legacy `PageTranslation.content` (§8.4), which
      // is raw HTML. A WYSIWYG field would rewrite that HTML on first open
      // and silently reformat pages nobody meant to touch.
      html: { type: "textarea" },
    },
    defaultProps: { html: "<p>Write something…</p>" },
    render: ({ html }) => (
      <div
        className="prose-page font-body text-ink"
        dangerouslySetInnerHTML={{ __html: sanitize(String(html ?? "")) }}
      />
    ),
  },

  Button: {
    label: "Button",
    fields: {
      label: { type: "text" },
      href: { type: "text" },
      variant: {
        type: "select",
        options: [
          { label: "Solid green", value: "solid" },
          { label: "Outline", value: "outline" },
        ],
      },
      align: { type: "select", options: opts(ALIGN) },
    },
    defaultProps: { label: "Shop now", href: "/products", variant: "solid", align: "left" },
    // A plain <a>, not next/link: this renders inside an RSC tree that the
    // admin also previews outside a Next router, where next/link throws.
    // Locale-prefixed hrefs are the author's to write, same as in the legacy
    // HTML these pages are migrating from.
    render: ({ label, href, variant, align }) => (
      <div className={ALIGN[align as keyof typeof ALIGN] ?? ALIGN.left}>
        <a
          href={String(href || "#")}
          className={`inline-flex items-center rounded-brand px-6 py-3 font-ui text-sm font-semibold transition ${
            variant === "outline"
              ? "border border-green text-green hover:bg-green hover:text-white"
              : "bg-green text-white hover:bg-green-dark"
          }`}
        >
          {String(label ?? "")}
        </a>
      </div>
    ),
  },

  // ----------------------------------------------------------------- media
  Image: {
    label: "Image",
    fields: {
      // Plain URL for now. The MediaPicker integration is a Puck `custom`
      // field and belongs with the editor in Phase 3 — a custom field renders
      // admin-only React, which has no place in this server-rendered set.
      url: { type: "text" },
      alt: { type: "text" },
      width: { type: "number" },
      height: { type: "number" },
      rounded: {
        type: "select",
        options: [
          { label: "None", value: "none" },
          { label: "Brand radius", value: "brand" },
        ],
      },
    },
    defaultProps: { url: "", alt: "", width: 1200, height: 800, rounded: "brand" },
    render: ({ url, alt, width, height, rounded }) => {
      if (!url) {
        return (
          <div className="grid h-48 place-items-center rounded-brand border border-dashed border-line bg-beige font-body text-sm text-muted">
            Choose an image
          </div>
        );
      }
      return (
        // Deliberately <img>, not next/image: next/image needs the app's
        // loader config, which this package cannot see, and these documents
        // also render inside the admin's preview iframe.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(url)}
          alt={String(alt ?? "")}
          width={Number(width) || undefined}
          height={Number(height) || undefined}
          loading="lazy"
          decoding="async"
          className={`h-auto w-full ${rounded === "none" ? "" : "rounded-brand"}`}
        />
      );
    },
  },

  // ---------------------------------------------------------------- embeds
  /**
   * A whole pasted page (Claude-designed landing pages, etc.), rendered in a
   * sandboxed iframe so its CSS cannot escape into the storefront and its
   * scripts cannot reach the parent document. Separate from HtmlEmbed on
   * purpose: that one is for a snippet that should inherit site styling, this
   * one is for a self-contained document. One block doing both would surprise
   * the author in one direction or the other.
   */
  HtmlPage: {
    // Just "HTML page": the block gained an Indexable mode and that is now
    // the default, so the old "(sandboxed)" label described the option most
    // authors should NOT pick.
    label: "HTML page",
    fields: {
      html: { type: "textarea" },
      mode: {
        type: "radio",
        options: [
          { label: "Indexable (recommended)", value: "inline" },
          { label: "Sandboxed (scripts run)", value: "sandboxed" },
        ],
      },
      fullBleed: {
        type: "radio",
        options: [
          { label: "Inside the site layout", value: "no" },
          { label: "Full screen (hide site header & footer)", value: "yes" },
        ],
      },
      minHeight: {
        type: "select",
        options: [
          { label: "Short (400px)", value: 400 },
          { label: "Medium (800px)", value: 800 },
          { label: "Tall (1400px)", value: 1400 },
        ],
      },
    },
    defaultProps: { html: "", mode: "inline", fullBleed: "no", minHeight: 800 },
    /**
     * Two genuinely different trades over the same pasted page, so the author
     * picks rather than the code deciding for them:
     *
     *   inline    - markup is in the served HTML, so it is INDEXED. CSS is
     *               mechanically scoped to this block. Scripts and inline
     *               handlers are stripped, like all authored HTML here.
     *   sandboxed - an iframe: scripts run and CSS is perfectly isolated, but
     *               the content is NOT indexed.
     *
     * `inline` is the fallback for a stored block with no `mode` yet, because
     * a landing page that search engines cannot see is usually the worse
     * surprise of the two.
     */
    render: ({ html, mode, minHeight, fullBleed, id }) =>
      mode === "sandboxed" ? (
        <SandboxedHtml
          html={String(html ?? "")}
          minHeight={Number(minHeight) || 800}
        />
      ) : (
        <InlineHtmlPage
          html={String(html ?? "")}
          id={String(id ?? "html")}
          fullBleed={fullBleed === "yes"}
        />
      ),
  },

  HtmlEmbed: {
    label: "HTML embed",
    fields: { html: { type: "textarea" } },
    defaultProps: { html: "" },
    // Sanitized like every other authored HTML on the site. §7.1 also calls
    // for an admin-only role gate; that lives in the editor (Phase 3), since
    // this render path has no notion of who is looking.
    render: ({ html }) => (
      <div dangerouslySetInnerHTML={{ __html: sanitize(String(html ?? "")) }} />
    ),
  },
};
