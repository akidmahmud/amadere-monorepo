// Shared so the admin form, the backend DTO and the preview renderer cannot
// disagree about the same limit.
//
// The preview is a RANGE of pages (start..end), not a count taken from the
// front of the document: a book's first pages are typically a cover, a
// copyright notice and a blank leaf, so "the first N pages" shows the buyer
// nothing worth reading. The admin picks the excerpt.

// Default range when a file is first uploaded and the admin has not chosen
// one yet: pages 1..DIGITAL_PREVIEW_PAGES_DEFAULT.
export const DIGITAL_PREVIEW_START_DEFAULT = 1;
export const DIGITAL_PREVIEW_PAGES_DEFAULT = 5;

// A generous ceiling on how MANY pages one range may cover — not a bound on
// where the range sits in the document. It bounds how much rendering work one
// upload can trigger. The document's own page count bounds the end page.
export const DIGITAL_PREVIEW_PAGES_MAX = 20;

// The general media endpoint caps at 20MB (admin-media.controller.ts), which
// is too small for a book. Raised for this endpoint only.
export const DIGITAL_FILE_MAX_BYTES = 50 * 1024 * 1024;
