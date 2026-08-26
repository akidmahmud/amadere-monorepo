/**
 * Shared page-builder types.
 *
 * Deliberately free of any React or Puck import. The NestJS backend validates
 * documents at publish time (plan §6.2) and must be able to do that without
 * pulling a UI library into the API process — which is also why `./validate`
 * is its own export subpath.
 */

/** Mirrors the Prisma `PageKind` enum. Duplicated rather than imported so
 *  this package does not depend on @amader/db (the admin and web bundles
 *  would then carry the Prisma client). Kept in sync by the test in
 *  validate.spec — if the enum gains a member, that fails. */
export type PageKind = "CONTENT" | "CHECKOUT";

export type Locale = "EN" | "BN";

/**
 * One block instance inside a document.
 *
 * `props` is intentionally loose here — the per-block prop shapes live with
 * the blocks themselves, and the zod validator narrows this at publish time.
 * Typing it as `unknown` instead would force a cast at every render site for
 * no real safety, since the document arrives as untyped JSON from the DB.
 */
export interface BlockData {
  type: string;
  props: Record<string, unknown> & { id: string };
}

/**
 * A Puck document as stored in `PageTranslation.layout`.
 *
 * `zones` is the legacy DropZone shape. We author with slot fields (see plan
 * §13.3), but a document that has been through Puck's own `migrate()` can
 * still carry the key, and rejecting it at validation would fail documents
 * that are otherwise fine.
 */
export interface PageDocument {
  root: { props?: Record<string, unknown> };
  content: BlockData[];
  zones?: Record<string, BlockData[]>;
}
