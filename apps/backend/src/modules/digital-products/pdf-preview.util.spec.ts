import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';
import { readPageCount, renderPreviewPages } from './pdf-preview.util';

// Generated in memory rather than checked in as a binary fixture, and in two
// sizes on purpose: DIGITAL_PREVIEW_PAGES_MAX (20) sits between them, so one
// fixture exercises the max clamp and the other exercises the (unclamped)
// case of a document running out of pages before the request is satisfied.
// A single fixture on one side of that line can never exercise the other
// behaviour, no matter how many tests you write against it.
async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([200, 200]);
    // Visible content, not a blank page — keeps the rendered-PNG size
    // assertions below meaningful instead of measuring an empty canvas.
    page.drawText(`Page ${i}`, { x: 50, y: 100, size: 20, font });
  }
  return Buffer.from(await doc.save());
}

// Rendering real PDF pages is slower than jest's 5s default.
jest.setTimeout(30_000);

describe('pdf-preview.util', () => {
  // 25 pages: more than DIGITAL_PREVIEW_PAGES_MAX (20), so the shared-max
  // clamp is the binding constraint and can actually be tested.
  let overMaxBuffer: Buffer;
  // 3 pages: fewer than the max, so requesting more than the document has
  // exercises the loop simply running out of pages, not the max clamp.
  let underMaxBuffer: Buffer;

  beforeAll(async () => {
    [overMaxBuffer, underMaxBuffer] = await Promise.all([makePdf(25), makePdf(3)]);
  });

  it('reads the page count without rendering', async () => {
    await expect(readPageCount(overMaxBuffer)).resolves.toBe(25);
    await expect(readPageCount(underMaxBuffer)).resolves.toBe(3);
  });

  it('renders exactly the requested range', async () => {
    const pages = await renderPreviewPages(overMaxBuffer, 5, 9);
    expect(pages).toHaveLength(5);
    pages.forEach((p) => expect(p.image.length).toBeGreaterThan(1000));
  });

  it('numbers each page with its REAL page number, not its index', async () => {
    // The whole point of the range: ProductPreviewPage is
    // @@unique([productId, pageNumber]) and the storefront prints
    // "Page 5 of 48", so a 5-9 range must not come back as 1-5.
    const pages = await renderPreviewPages(overMaxBuffer, 5, 9);
    expect(pages.map((p) => p.pageNumber)).toEqual([5, 6, 7, 8, 9]);
  });

  it('renders the page the range actually points at, not the first page', async () => {
    // Each fixture page carries different drawn text, so page 5 and page 1
    // cannot render to the same bytes. This is the assertion that would fail
    // if the renderer quietly went back to taking pages from the front.
    const [fromFive] = await renderPreviewPages(overMaxBuffer, 5, 5);
    const [fromOne] = await renderPreviewPages(overMaxBuffer, 1, 1);
    expect(fromFive.pageNumber).toBe(5);
    expect(fromFive.image.equals(fromOne.image)).toBe(false);
  });

  it('returns PNG buffers', async () => {
    const [first] = await renderPreviewPages(overMaxBuffer, 1, 1);
    // PNG magic number.
    expect(first.image.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('stops at the last page when the range runs past the document', async () => {
    // An admin whose 10-page book was replaced by a 3-page one doesn't get an
    // error out of the renderer — the service validates and the form
    // validates, but a stale stored range must degrade, not throw.
    const pages = await renderPreviewPages(underMaxBuffer, 2, 10);
    expect(pages.map((p) => p.pageNumber)).toEqual([2, 3]);
  });

  it('clamps the range LENGTH to the shared maximum', async () => {
    // 25 pages is enough to satisfy any request up to the max, so a request
    // of 1-999 isolates the max clamp: it would fail if
    // DIGITAL_PREVIEW_PAGES_MAX were removed, since the document could
    // otherwise supply all 25 pages.
    const pages = await renderPreviewPages(overMaxBuffer, 1, 999);
    expect(pages).toHaveLength(DIGITAL_PREVIEW_PAGES_MAX);
    // ...and the cap is on LENGTH, not on the page number, so a range that
    // starts late still gets its full allowance rather than being cut at
    // page DIGITAL_PREVIEW_PAGES_MAX.
    const late = await renderPreviewPages(overMaxBuffer, 20, 999);
    expect(late.map((p) => p.pageNumber)).toEqual([20, 21, 22, 23, 24, 25]);
  });

  it('treats a zero or negative start as page one, and an end before the start as a single page', async () => {
    await expect(renderPreviewPages(overMaxBuffer, 0, 0)).resolves.toHaveLength(1);
    await expect(renderPreviewPages(overMaxBuffer, -5, -5)).resolves.toHaveLength(1);
    const backwards = await renderPreviewPages(overMaxBuffer, 7, 3);
    expect(backwards.map((p) => p.pageNumber)).toEqual([7]);
  });

  it('rejects a buffer that is not a PDF', async () => {
    await expect(readPageCount(Buffer.from('not a pdf'))).rejects.toBeDefined();
  });
});
