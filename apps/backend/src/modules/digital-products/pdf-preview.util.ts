import { DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';

// pdf-to-img is ESM-only, so it is loaded through a dynamic import rather than
// a top-level require — the backend compiles to CommonJS. Its compiled output
// also uses `import.meta.url` internally, which TypeScript cannot downlevel
// to CommonJS at all, so this can't be made to work via ts-jest transform
// config. Jest itself must run with `--experimental-vm-modules` so its module
// loader can hand pdf-to-img to Node's real ESM loader. The backend's `test`
// and `test:cov` npm scripts set that flag via cross-env; running `jest`
// directly (`pnpm --filter @amader/backend exec jest ...`) without it will
// fail every test in this file except the "not a PDF" rejection case.
async function loadPdf() {
  const mod = await import('pdf-to-img');
  return mod.pdf;
}

/** A rendered page carries its REAL page number in the source document — the
 * preview is a range like 5..9, so an index into the returned array is not
 * the page the reader is looking at. ProductPreviewPage.pageNumber stores
 * this value, and the storefront prints it as "Page 5 of 48". */
export interface RenderedPreviewPage {
  pageNumber: number;
  image: Buffer;
}

/** Page count without rendering anything — ~66ms on a 42-page document, so the
 * admin can validate the preview-page setting the moment a file is chosen. */
export async function readPageCount(buffer: Buffer): Promise<number> {
  const pdf = await loadPdf();
  const doc = await pdf(buffer);
  try {
    return doc.length;
  } finally {
    // pdfjs's loading task holds worker, font and cache resources until
    // destroyed. This runs inside a long-lived Nest process, so every call
    // that skipped this would leak a little more, forever. Guarded in case
    // a future pdf-to-img version stops exposing destroy().
    await doc.destroy?.();
  }
}

/**
 * Renders the inclusive page range `startPage`..`endPage` to PNG buffers.
 *
 * Runs once at upload time, never per request. Defensively clamped, because
 * a stored range can go stale the moment the admin replaces the PDF with a
 * shorter one: the start is pulled to at least 1, the end to at least the
 * start, the range LENGTH to DIGITAL_PREVIEW_PAGES_MAX (so no single upload
 * can trigger hundreds of renders), and the whole range to what the document
 * actually contains. The real, user-facing validation lives in
 * DigitalProductsService — this clamp exists so a stale value degrades to a
 * shorter preview instead of throwing.
 */
export async function renderPreviewPages(
  buffer: Buffer,
  startPage: number,
  endPage: number,
): Promise<RenderedPreviewPage[]> {
  const pdf = await loadPdf();
  // scale 1.5 keeps text readable when the preview modal shows a page at
  // roughly half a screen wide; ~130KB per page.
  const doc = await pdf(buffer, { scale: 1.5 });
  try {
    const first = Math.max(Math.trunc(startPage) || 1, 1);
    const last = Math.min(
      Math.max(Math.trunc(endPage) || first, first),
      first + DIGITAL_PREVIEW_PAGES_MAX - 1,
      doc.length,
    );

    const pages: RenderedPreviewPage[] = [];
    // getPage() is 1-indexed and addresses a page directly, unlike the
    // for-await iterator the first-N-pages version used — which could only
    // ever start at page 1 and would have to render and discard everything
    // before the range.
    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      pages.push({ pageNumber, image: await doc.getPage(pageNumber) });
    }
    return pages;
  } finally {
    // See readPageCount — same leak, same guard.
    await doc.destroy?.();
  }
}
