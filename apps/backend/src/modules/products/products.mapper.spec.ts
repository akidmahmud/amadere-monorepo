import { toPublicProductDigitalFields } from './products.mapper';
import type { ProductWithRelations } from './products.mapper';

// A DIGITAL product row as Prisma actually returns it — including
// digitalFileKey, which is the whole point of these tests: the R2 bucket is
// fully public, so that key is a permanent unauthenticated download link to
// the paid PDF and must never reach a public response.
function digitalProductRow(
  overrides: Partial<ProductWithRelations> = {},
): ProductWithRelations {
  return {
    id: 93,
    slug: 'task9-test-ebook',
    productType: 'DIGITAL',
    digitalFileKey: 'digital/2f0c-secret-ebook.pdf',
    digitalFileName: 'ebook.pdf',
    digitalFileSize: 1_234_567,
    digitalPageCount: 10,
    digitalPreviewStartPage: 2,
    digitalPreviewEndPage: 4,
    previewPages: [
      { id: 1, productId: 93, pageNumber: 1, imageUrl: 'https://cdn.test/preview-93-1.png' },
      { id: 2, productId: 93, pageNumber: 2, imageUrl: 'https://cdn.test/preview-93-2.png' },
    ],
    ...overrides,
  } as unknown as ProductWithRelations;
}

describe('toPublicProductDigitalFields', () => {
  it('exposes the page counts and the public preview image URLs', () => {
    const result = toPublicProductDigitalFields(digitalProductRow());

    expect(result.digitalPageCount).toBe(10);
    expect(result.digitalPreviewStartPage).toBe(2);
    expect(result.digitalPreviewEndPage).toBe(4);
    expect(result.previewPages).toEqual([
      { pageNumber: 1, imageUrl: 'https://cdn.test/preview-93-1.png' },
      { pageNumber: 2, imageUrl: 'https://cdn.test/preview-93-2.png' },
    ]);
  });

  // The Specification tab's "Type" row. Derived from the filename rather
  // than stored, so it cannot disagree with the file actually delivered.
  it('derives the file format from the filename, uppercased, with its size', () => {
    const result = toPublicProductDigitalFields(digitalProductRow());

    expect(result.digitalFileFormat).toBe('PDF');
    expect(result.digitalFileSize).toBe(1_234_567);
  });

  it('yields a null format for a filename with no extension', () => {
    const result = toPublicProductDigitalFields(
      digitalProductRow({ digitalFileName: 'ebook' } as unknown as Partial<ProductWithRelations>),
    );

    expect(result.digitalFileFormat).toBeNull();
  });

  // The regression guard. Asserted against the serialised JSON rather than
  // the object's own keys so a nested leak (e.g. a whole product row smuggled
  // onto a preview page) fails too.
  it('never leaks digitalFileKey — or the key VALUE anywhere in the payload', () => {
    const result = toPublicProductDigitalFields(digitalProductRow());

    expect(result).not.toHaveProperty('digitalFileKey');
    expect(JSON.stringify(result)).not.toContain('digitalFileKey');
    expect(JSON.stringify(result)).not.toContain('digital/2f0c-secret-ebook.pdf');
    // digitalFileName is a COMPONENT of that key, and the "Type" row needs
    // only its extension — so the name itself stays private too. This is the
    // assertion that fails if someone "helpfully" adds it back to the DTO.
    expect(result).not.toHaveProperty('digitalFileName');
    expect(JSON.stringify(result)).not.toContain('ebook.pdf');
  });

  it('yields nulls and an empty preview list for a PHYSICAL product', () => {
    const result = toPublicProductDigitalFields(
      digitalProductRow({
        productType: 'PHYSICAL',
        digitalFileKey: null,
        digitalPageCount: null,
        digitalPreviewStartPage: null,
        digitalPreviewEndPage: null,
        digitalFileName: null,
        digitalFileSize: null,
        previewPages: [],
      } as unknown as Partial<ProductWithRelations>),
    );

    // Exact shape on purpose: toEqual here is a second, structural guard
    // against a field being added to this mapper without being noticed.
    expect(result).toEqual({
      digitalPageCount: null,
      digitalPreviewStartPage: null,
      digitalPreviewEndPage: null,
      digitalFileFormat: null,
      digitalFileSize: null,
      previewPages: [],
    });
  });
});
