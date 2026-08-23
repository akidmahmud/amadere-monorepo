import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';
import type { MediaStorage } from '../media/storage/media-storage.interface';
import { sanitizeFilename } from '../media/media.service';
import {
  DIGITAL_PREVIEW_PAGES_DEFAULT,
  DIGITAL_PREVIEW_PAGES_MAX,
  DIGITAL_PREVIEW_START_DEFAULT,
} from '@amader/shared';
import { readPageCount, renderPreviewPages } from './pdf-preview.util';
import type { AdminDigitalFileDto } from './dto/digital-file-response.dto';

type PreviewRow = { productId: number; pageNumber: number; imageUrl: string };

// Never digitalFileKey — see AdminDigitalFileDto's own comment for why.
function toSafeDto(
  product: {
    id: number;
    digitalFileName: string | null;
    digitalFileSize: number | null;
    digitalPageCount: number | null;
    digitalPreviewStartPage: number | null;
    digitalPreviewEndPage: number | null;
  },
  previewPages: { pageNumber: number; imageUrl: string }[],
): AdminDigitalFileDto {
  return {
    id: product.id,
    digitalFileName: product.digitalFileName,
    digitalFileSize: product.digitalFileSize,
    digitalPageCount: product.digitalPageCount,
    digitalPreviewStartPage: product.digitalPreviewStartPage,
    digitalPreviewEndPage: product.digitalPreviewEndPage,
    previewPages: previewPages
      .map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl }))
      .sort((a, b) => a.pageNumber - b.pageNumber),
  };
}

@Injectable()
export class DigitalProductsService {
  private readonly logger = new Logger(DigitalProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Uploads the PDF privately, records its metadata, and renders the preview
   * pages. Rendering happens here, once, rather than per request. */
  async attachFile(productId: number, file: Express.Multer.File): Promise<AdminDigitalFileDto> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported for digital products');
    }
    const product = await this.prisma.client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.productType !== 'DIGITAL') {
      throw new BadRequestException('This product is not a digital product');
    }

    const pageCount = await readPageCount(file.buffer);

    // Private: the key is stored, never a URL. See the interface comment.
    const key = `digital/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    await this.storage.uploadPrivate(key, file.buffer, 'application/pdf');

    // Carry the admin's existing range across a re-upload where it still
    // fits, rather than silently resetting it — replacing a file with a
    // corrected edition is the common case. Anything that no longer fits the
    // new document is pulled back to something that does; setPreviewRange is
    // where an out-of-range value is an ERROR, because there the admin typed
    // it and needs to be told.
    const { startPage, endPage } = clampRangeToDocument(
      product.digitalPreviewStartPage ?? DIGITAL_PREVIEW_START_DEFAULT,
      product.digitalPreviewEndPage ?? DIGITAL_PREVIEW_PAGES_DEFAULT,
      pageCount,
    );
    const previewRows = await this.renderPreviewImages(productId, file.buffer, startPage, endPage);

    // Captured before the transaction below removes the rows, so the old
    // objects can still be deleted from storage afterward. See deletePreviewObjects.
    const oldPreviews = await this.prisma.client.productPreviewPage.findMany({ where: { productId } });

    const updated = await this.replacePreviewsAndUpdateProduct(productId, previewRows, {
      digitalFileKey: key,
      digitalFileName: file.originalname,
      digitalFileSize: file.size,
      digitalPageCount: pageCount,
      digitalPreviewStartPage: startPage,
      digitalPreviewEndPage: renderedEndPage(previewRows, endPage),
    });

    await this.deletePreviewObjects(oldPreviews);

    return toSafeDto(updated, previewRows);
  }

  async removeFile(productId: number): Promise<AdminDigitalFileDto> {
    const product = await this.prisma.client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const oldPreviews = await this.prisma.client.productPreviewPage.findMany({ where: { productId } });

    // Same fail-safe direction as attachFile/setPreviewRange below: commit
    // the DB change first, so a storage failure afterward leaves at worst an
    // orphaned (invisible) R2 object rather than a product still pointing at
    // a file whose deletion silently failed.
    const updated = await this.prisma.client.$transaction(async (tx) => {
      await tx.productPreviewPage.deleteMany({ where: { productId } });
      return tx.product.update({
        where: { id: productId },
        data: {
          digitalFileKey: null,
          digitalFileName: null,
          digitalFileSize: null,
          digitalPageCount: null,
          digitalPreviewStartPage: null,
          digitalPreviewEndPage: null,
        },
      });
    });

    if (product.digitalFileKey) {
      try {
        await this.storage.delete(product.digitalFileKey);
      } catch (err) {
        this.logger.error(`Failed to delete PDF object ${product.digitalFileKey}`, err as Error);
      }
    }
    await this.deletePreviewObjects(oldPreviews);

    return toSafeDto(updated, []);
  }

  /** Changing WHICH pages the preview shows re-renders from the stored PDF
   * — the admin never has to re-upload to change this.
   *
   * Every bound is enforced here and not only in the admin form: these are
   * plain HTTP endpoints, and an out-of-range value must come back as a
   * readable 400, not a 500 from the renderer. */
  async setPreviewRange(productId: number, startPage: number, endPage: number): Promise<AdminDigitalFileDto> {
    const product = await this.prisma.client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.digitalFileKey) throw new BadRequestException('This product has no file yet');
    if (!Number.isInteger(startPage) || startPage < 1) {
      throw new BadRequestException('The start page must be 1 or higher');
    }
    if (!Number.isInteger(endPage) || endPage < startPage) {
      throw new BadRequestException(
        `The end page (${endPage}) cannot be before the start page (${startPage})`,
      );
    }
    // Checked before the length cap on purpose: when both are wrong, "your
    // book only has 48 pages" tells the admin more than "at most 20 pages".
    if (product.digitalPageCount && endPage > product.digitalPageCount) {
      throw new BadRequestException(
        `End page ${endPage} is beyond the document's ${product.digitalPageCount} pages`,
      );
    }
    const length = endPage - startPage + 1;
    if (length > DIGITAL_PREVIEW_PAGES_MAX) {
      throw new BadRequestException(
        `A preview can cover at most ${DIGITAL_PREVIEW_PAGES_MAX} pages — pages ${startPage}-${endPage} is ${length}`,
      );
    }

    const stream = await this.storage.getObjectStream(product.digitalFileKey);
    const buffer = await streamToBuffer(stream);
    const previewRows = await this.renderPreviewImages(productId, buffer, startPage, endPage);

    const oldPreviews = await this.prisma.client.productPreviewPage.findMany({ where: { productId } });

    const updated = await this.replacePreviewsAndUpdateProduct(productId, previewRows, {
      digitalPreviewStartPage: startPage,
      digitalPreviewEndPage: renderedEndPage(previewRows, endPage),
    });

    await this.deletePreviewObjects(oldPreviews);

    return toSafeDto(updated, previewRows);
  }

  // ------------------------------------------------------------------

  /** Renders and uploads the preview PNGs (public path — see interface
   * comment on PrivateObject) without touching the database. Kept separate
   * from the DB write so storage work — which cannot join a Prisma
   * transaction — always happens before the transaction that commits it,
   * per replacePreviewsAndUpdateProduct's comment. */
  private async renderPreviewImages(
    productId: number,
    pdf: Buffer,
    startPage: number,
    endPage: number,
  ): Promise<PreviewRow[]> {
    const pages = await renderPreviewPages(pdf, startPage, endPage);
    const rows: PreviewRow[] = [];
    for (const page of pages) {
      // PUBLIC on purpose: preview pages are the free sample.
      //
      // pageNumber is the page's REAL number in the document (5..9 for a
      // 5-9 range), not its index in this batch — ProductPreviewPage is
      // @@unique([productId, pageNumber]) and the storefront prints it as
      // "Page 5 of 48". The randomUUID in the key means a re-render never
      // collides with, or silently overwrites, the object it replaces, even
      // when the same page number appears in both the old and the new range;
      // deletePreviewObjects removes the superseded ones.
      const { url } = await this.storage.upload(
        `image/preview-${productId}-${page.pageNumber}-${randomUUID()}.png`,
        page.image,
        'image/png',
      );
      rows.push({ productId, pageNumber: page.pageNumber, imageUrl: url });
    }
    return rows;
  }

  /** Replaces the preview rows and updates the product's digital fields in
   * one Prisma transaction, so they land together or not at all. Storage
   * operations (the actual PDF/PNG uploads) cannot join this transaction —
   * that's fine and expected, so callers must do all uploading/rendering
   * first and pass only the already-uploaded rows in here. A failed
   * transaction may then leave orphaned storage objects, which is the
   * preferable direction: an orphaned object is invisible and harmless,
   * while a product row pointing at a file that was never actually recorded
   * (e.g. offered at checkout as a download that doesn't exist) is not. */
  private async replacePreviewsAndUpdateProduct(
    productId: number,
    previewRows: PreviewRow[],
    productData: Record<string, unknown>,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      // Replace wholesale — a shorter preview must not leave stale later
      // pages referenced in the DB, which would leak content the admin just
      // decided to hide (the underlying objects are cleaned up by the
      // caller via deletePreviewObjects, using rows read before this ran).
      await tx.productPreviewPage.deleteMany({ where: { productId } });
      if (previewRows.length) {
        await tx.productPreviewPage.createMany({ data: previewRows });
      }
      return tx.product.update({ where: { id: productId }, data: productData });
    });
  }

  /** Best-effort cleanup of preview objects that are no longer referenced by
   * any ProductPreviewPage row (superseded by a re-render, or the product's
   * file was removed entirely). Preview URLs are public, so a page left
   * un-deleted here stays fetchable forever — that's the bug this exists to
   * close. A single delete failing must not fail the caller's request: a
   * leftover object is invisible and harmless, whereas surfacing an error
   * here would block an admin action that already succeeded from the DB's
   * point of view. */
  private async deletePreviewObjects(pages: { imageUrl: string }[]): Promise<void> {
    for (const page of pages) {
      const key = keyFromPreviewUrl(page.imageUrl);
      if (!key) continue;
      try {
        await this.storage.delete(key);
      } catch (err) {
        this.logger.error(`Failed to delete stale preview object ${key}`, err as Error);
      }
    }
  }
}

/** Preview objects are uploaded through the PUBLIC path (see
 * renderPreviewImages), so ProductPreviewPage.imageUrl stores a full URL —
 * but MediaStorage.delete() takes a key, not a URL, and R2MediaStorage never
 * hands the key back out once upload() has turned it into a URL. Every
 * preview key this service mints is fixed under the `image/` prefix, so
 * recovering it is just slicing off everything before that marker. This
 * avoids depending on R2_PUBLIC_BASE_URL's own shape (it may or may not
 * include a path component) to reconstruct the split correctly. */
function keyFromPreviewUrl(url: string): string | null {
  const marker = '/image/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + 1); // drop the leading slash; keep 'image/...'
}

/** Pulls a possibly-stale stored range inside what the document can actually
 * supply, preserving the admin's intent where it still makes sense: an
 * out-of-document start falls back to the front of the book, and the end is
 * trimmed to the document and to DIGITAL_PREVIEW_PAGES_MAX pages. */
function clampRangeToDocument(
  startPage: number,
  endPage: number,
  pageCount: number,
): { startPage: number; endPage: number } {
  const start = startPage >= 1 && startPage <= pageCount ? startPage : DIGITAL_PREVIEW_START_DEFAULT;
  const end = Math.max(start, Math.min(endPage, pageCount, start + DIGITAL_PREVIEW_PAGES_MAX - 1));
  return { startPage: start, endPage: end };
}

/** The end page actually rendered. The renderer stops at the document's last
 * page, so this keeps the stored range from claiming pages that produced no
 * preview row — the storefront reads both, and they must agree. */
function renderedEndPage(rows: PreviewRow[], requestedEndPage: number): number {
  return rows.length ? rows[rows.length - 1].pageNumber : requestedEndPage;
}

async function streamToBuffer(stream: NodeJS.ReadableStream | null): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
