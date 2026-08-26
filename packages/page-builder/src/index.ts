/**
 * Root export. Phase 1 is types + validation only; the Puck config and the
 * block components land in Phases 2 and 4.
 *
 * Anything React-dependent added here must NOT be re-exported from
 * `./validate` — the backend imports that subpath and must stay React-free.
 */
export * from "./types";
export * from "./block-names";
export * from "./required-blocks";
export * from "./reserved-slugs";
export { validatePageDocument, isRenderableDocument } from "./validate";
export type { ValidationResult } from "./validate";

// NOTE: nothing React-dependent may be exported from here. This file is
// compiled into dist and the NestJS backend resolves "." through it; a single
// re-export of a component pulls React into the API process. The checkout slot
// plumbing is exported from ./config instead, which ships as source.
