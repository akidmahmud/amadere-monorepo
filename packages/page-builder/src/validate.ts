import { z } from "zod";
import { isKnownBlock, isCheckoutBlock } from "./block-names";
import {
  REQUIRED_CHECKOUT_BLOCKS,
  REQUIRED_CHECKOUT_BLOCKS_ONE_OF,
  blockLabel,
} from "./required-blocks";
import type { PageDocument, PageKind } from "./types";

export { checkReservedSlug, RESERVED_SLUGS } from "./reserved-slugs";
export * from "./block-names";
export * from "./required-blocks";
export type { PageDocument, PageKind, BlockData, Locale } from "./types";

/**
 * A block instance. `id` is required because Puck addresses every instance by
 * it — a document missing one renders but cannot be edited afterwards, which
 * is a worse failure than refusing to publish it.
 */
const blockSchema: z.ZodType<{ type: string; props: Record<string, unknown> & { id: string } }> =
  z.lazy(() =>
    z.object({
      type: z.string().min(1),
      props: z.looseObject({ id: z.string().min(1) }),
    }),
  );

const documentSchema = z.object({
  root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).loose(),
  content: z.array(blockSchema),
  zones: z.record(z.string(), z.array(blockSchema)).optional(),
});

export interface ValidationResult {
  ok: boolean;
  /** Empty when ok. Each entry is safe to show the owner verbatim. */
  errors: string[];
  /** Present only when ok — the parsed document, narrowed. */
  document?: PageDocument;
}

/**
 * Every block in the document, including those nested in slots and in legacy
 * zones. Slot props are arrays of block objects, so this walks any array-valued
 * prop whose entries look like blocks rather than hardcoding slot prop names —
 * blocks are free to name their slots whatever reads best.
 */
function collectBlocks(doc: PageDocument): { type: string; props: Record<string, unknown> }[] {
  const found: { type: string; props: Record<string, unknown> }[] = [];

  function isBlockish(value: unknown): value is { type: string; props: Record<string, unknown> } {
    return (
      !!value &&
      typeof value === "object" &&
      typeof (value as { type?: unknown }).type === "string" &&
      typeof (value as { props?: unknown }).props === "object"
    );
  }

  function walk(block: { type: string; props: Record<string, unknown> }) {
    found.push(block);
    for (const value of Object.values(block.props ?? {})) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) if (isBlockish(entry)) walk(entry);
    }
  }

  doc.content.forEach(walk);
  for (const zone of Object.values(doc.zones ?? {})) zone.forEach(walk);
  return found;
}

/**
 * Publish-time validation (plan §6.2.1 and §6.2.3).
 *
 * Returns collected errors rather than throwing on the first one: an owner who
 * has to fix four problems should be told all four, not sent round the loop
 * four times.
 */
export function validatePageDocument(input: unknown, kind: PageKind): ValidationResult {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "document"}: ${issue.message}`,
      ),
    };
  }

  const document = parsed.data as PageDocument;
  const errors: string[] = [];
  const blocks = collectBlocks(document);

  const unknown = [...new Set(blocks.map((b) => b.type).filter((t) => !isKnownBlock(t)))];
  if (unknown.length > 0) {
    errors.push(`Unknown block${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`);
  }

  // Duplicate ids break Puck's addressing and make the editor act on the
  // wrong instance — cheap to detect here, baffling to debug later.
  const ids = blocks.map((b) => String(b.props?.id ?? ""));
  const duplicates = [...new Set(ids.filter((id, i) => id && ids.indexOf(id) !== i))];
  if (duplicates.length > 0) {
    errors.push(`Duplicate block ids: ${duplicates.join(", ")}.`);
  }

  if (kind === "CHECKOUT") {
    const present = new Set(blocks.map((b) => b.type));

    const missing = REQUIRED_CHECKOUT_BLOCKS.filter((name) => !present.has(name));
    if (missing.length > 0) {
      errors.push(`A checkout page must contain: ${missing.map(blockLabel).join(", ")}.`);
    }

    // Exactly once, not merely present: two Place Order buttons submit the
    // same form twice and two Order Summaries disagree about the total.
    for (const name of REQUIRED_CHECKOUT_BLOCKS) {
      const count = blocks.filter((b) => b.type === name).length;
      if (count > 1) {
        errors.push(`A checkout page may contain only one ${blockLabel(name)} (found ${count}).`);
      }
    }

    if (!REQUIRED_CHECKOUT_BLOCKS_ONE_OF.some((name) => present.has(name))) {
      errors.push(
        `A checkout page must contain at least one of: ${REQUIRED_CHECKOUT_BLOCKS_ONE_OF.map(blockLabel).join(" or ")}.`,
      );
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], document };
}

/**
 * Does this document contain any checkout block?
 *
 * The storefront asks before rendering a content page: a page with checkout
 * blocks needs the checkout brain mounted around it, and a page without one
 * must NOT pay for that (the provider fetches the cart and payment config).
 */
export function documentUsesCheckoutBlocks(input: unknown): boolean {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return false;
  return collectBlocks(parsed.data as PageDocument).some((b) => {
    if (isCheckoutBlock(b.type)) return true;
    // A checkout block can also be embedded INSIDE a pasted HTML page, as a
    // `data-amader-block` placeholder that HtmlBlockPortals fills after mount.
    // Those never appear as document nodes, so looking only at block types
    // missed them -- the page rendered without the checkout brain and the
    // placeholder filled with "no implementation" instead of the order form.
    return Object.values(b.props ?? {}).some(
      (v) => typeof v === "string" && v.includes("data-amader-block"),
    );
  });
}

/** Convenience for the storefront: is this stored value safe to render? */
export function isRenderableDocument(input: unknown, kind: PageKind = "CONTENT"): boolean {
  return validatePageDocument(input, kind).ok;
}
