# Digital Products (Spec 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A product that is a PDF can be created in the admin, bought at checkout, and downloaded by the buyer — with the source file never publicly reachable.

**Architecture:** Digital products are ordinary `Product` rows with `productType = 'DIGITAL'` plus a private PDF and pre-rendered preview page images. The PDF is stored in R2 under a key that is never turned into a public URL; downloads go through an entitlement-checked backend endpoint that streams the object. A digital-only order skips shipping, address and stock, never enters the courier dispatch queue, and completes on payment confirmation so Net Profit still sees it.

**Tech Stack:** NestJS 11 + Prisma (backend), Next.js 16 App Router + TanStack Query (admin, web), `pdf-to-img` for server-side page rendering, Jest + ts-jest (backend tests only).

**Spec:** `docs/superpowers/specs/2026-08-22-digital-products-design.md`

## Global Constraints

- **The source PDF must never become a public URL.** Store the R2 **key**, never `${publicBaseUrl}/${key}`. Every download goes through the entitlement-checked endpoint.
- **Preview page images ARE public** — they are the free sample and use the normal public media path.
- **PDF upload limit: 50MB**, on the digital-file endpoint only. The global media limit stays 20MB.
- **Accepted MIME: `application/pdf` only.**
- **Default preview pages: 5.** Validated against the document's real page count.
- **Digital-only = every line's `productTypeSnapshot` is `DIGITAL`.** A mixed order is treated as physical throughout.
- **Account takeover rule:** if the checkout email or phone matches an existing **verified** customer, do NOT issue a session. Attach the download, email it, and ask them to sign in.
- **Created accounts have `passwordHash = null`.** No password field at checkout, and no password-reset email flow is built — `POST /customers/me/password` already covers setting one later.
- **`unlockedAt` is set on payment confirmation**, not order placement. Free (৳0) orders confirm immediately.
- **Only `apps/backend` has a test runner.** `apps/admin` and `apps/web` have none — do not add one. Their verification is `tsc --noEmit` plus stated manual browser checks.
- **Working directory for all commands is `h:/Amder Project/backend`** (the git root).
- Dev servers are already running: backend `:3000`, web `:3001`, admin `:3004`. Postgres is in Docker as `backend-postgres-1`; the database is **`amader_migration`**, not `amader`.
- The seed needs `DATABASE_URL`, `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` exported from `.env` first — nothing auto-loads it.

---

### Task 1: Schema, permissions and shared constants

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/shared/src/permission-catalog.ts`
- Create: `packages/shared/src/digital-products.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `ProductPreviewPage`, `DigitalDownload`; `Product.digitalFileKey/digitalFileName/digitalFileSize/digitalPageCount/digitalPreviewPages`; `OrderItem.productTypeSnapshot`. Constants `DIGITAL_PREVIEW_PAGES_DEFAULT`, `DIGITAL_PREVIEW_PAGES_MAX`, `DIGITAL_FILE_MAX_BYTES`. Permissions `digital_product.view|create|update|delete`.

- [ ] **Step 1: Add the shared constants**

Create `packages/shared/src/digital-products.ts`:

```ts
// Shared so the admin form, the backend DTO and the preview renderer cannot
// disagree about the same limit.
export const DIGITAL_PREVIEW_PAGES_DEFAULT = 5;

// A generous ceiling, not a product rule — it bounds how much rendering work
// one upload can trigger. The real cap is the document's own page count.
export const DIGITAL_PREVIEW_PAGES_MAX = 20;

// The general media endpoint caps at 20MB (admin-media.controller.ts), which
// is too small for a book. Raised for this endpoint only.
export const DIGITAL_FILE_MAX_BYTES = 50 * 1024 * 1024;
```

Add to `packages/shared/src/index.ts`, following the existing export style:

```ts
export * from './digital-products';
```

- [ ] **Step 2: Add the permissions**

In `packages/shared/src/permission-catalog.ts`, insert after the `perm('product', 'delete'),` line:

```ts

  perm('digital_product', 'view'),
  perm('digital_product', 'create'),
  perm('digital_product', 'update'),
  perm('digital_product', 'delete'),
```

- [ ] **Step 3: Add the Product fields**

In `packages/db/prisma/schema.prisma`, inside `model Product`, next to the existing `productType` field:

```prisma
  // --- Digital products (productType = DIGITAL) -----------------------
  // The R2 object KEY, never a public URL. The file is served only by the
  // entitlement-checked download endpoint; turning this into a public URL
  // would make every paid book freely downloadable by anyone with the link.
  digitalFileKey      String? @map("digital_file_key")
  digitalFileName     String? @map("digital_file_name")
  digitalFileSize     Int?    @map("digital_file_size")
  digitalPageCount    Int?    @map("digital_page_count")
  /// Null means DIGITAL_PREVIEW_PAGES_DEFAULT.
  digitalPreviewPages Int?    @map("digital_preview_pages")

  previewPages     ProductPreviewPage[]
  digitalDownloads DigitalDownload[]
```

- [ ] **Step 4: Add `productTypeSnapshot` to OrderItem**

In `model OrderItem`, beside `skuSnapshot`:

```prisma
  /// Snapshotted like productNameSnapshot/skuSnapshot beside it. Neither
  /// CartItem nor OrderItem carried product type before this feature, so
  /// every "is this order digital?" check would otherwise re-join to Product
  /// — and would answer wrongly if the product were later edited or deleted.
  productTypeSnapshot ProductType @default(PHYSICAL) @map("product_type_snapshot")
```

- [ ] **Step 5: Add the two new models**

Append near `ProductFile` (leave `ProductFile` itself untouched — it is an unused stub whose `url String` shape presumes the public URL this feature must not create):

```prisma
model ProductPreviewPage {
  id         Int    @id @default(autoincrement())
  productId  Int    @map("product_id")
  pageNumber Int    @map("page_number")
  /// Public URL. These are the free sample and are meant to be readable.
  imageUrl   String @map("image_url")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, pageNumber])
  @@map("product_preview_pages")
}

/// A buyer's entitlement to one digital product from one order. Separate from
/// OrderItem so a download can be counted and re-issued without rewriting
/// order history.
model DigitalDownload {
  id             Int       @id @default(autoincrement())
  orderId        Int       @map("order_id")
  productId      Int       @map("product_id")
  customerId     Int?      @map("customer_id")
  /// Unguessable, emailed to the buyer. Works with no session so a guest can
  /// download straight from the email link.
  token          String    @unique
  downloadCount  Int       @default(0) @map("download_count")
  lastDownloadAt DateTime? @map("last_download_at")
  /// Null until payment is confirmed. The endpoint refuses while null.
  unlockedAt     DateTime? @map("unlocked_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  order    Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product  Product   @relation(fields: [productId], references: [id])
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([customerId])
  @@map("digital_downloads")
}
```

Add the back-relations: `digitalDownloads DigitalDownload[]` on both `model Order` and `model Customer`.

- [ ] **Step 6: Generate the migration**

Run:

```bash
set -a; . ./.env; set +a
pnpm --filter @amader/db exec prisma migrate dev --name digital_products
```

Expected: a new folder under `packages/db/prisma/migrations/`, and the Prisma client regenerates. If `migrate dev` refuses because of drift, STOP and report — do not use `--force-reset`, which drops the database.

- [ ] **Step 7: Build shared and seed the permissions**

```bash
pnpm --filter @amader/shared build
set -a; . ./.env; set +a
pnpm --filter @amader/db exec tsx prisma/seed.ts
```

- [ ] **Step 8: Verify**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "\d digital_downloads" | head -15
docker exec backend-postgres-1 psql -U amader -d amader_migration -t -c "select key from permissions where resource='digital_product' order by key;"
pnpm --filter @amader/backend exec tsc --noEmit -p tsconfig.json
```

Expected: the table exists, four permission rows, 0 type errors.

---

### Task 2: PDF preview renderer

**Files:**
- Create: `apps/backend/src/modules/digital-products/pdf-preview.util.ts`
- Test: `apps/backend/src/modules/digital-products/pdf-preview.util.spec.ts`
- Modify: `apps/backend/package.json` (add `pdf-to-img`)

**Interfaces:**
- Consumes: `DIGITAL_PREVIEW_PAGES_MAX` from `@amader/shared`.
- Produces: `readPageCount(buffer: Buffer): Promise<number>` and `renderPreviewPages(buffer: Buffer, count: number): Promise<Buffer[]>` — used by Task 3.

Kept a pure module with no Nest or Prisma around it, because this is the piece with a real algorithm and it deserves direct tests.

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter @amader/backend add pdf-to-img
```

Note: this adds roughly 69MB to `node_modules`. It ships prebuilt binaries and needs no native build tools — verified on Windows and expected to work on the Linux server.

- [ ] **Step 2: Write the failing test**

Create `apps/backend/src/modules/digital-products/pdf-preview.util.spec.ts`. It uses a real PDF already in the repo:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { readPageCount, renderPreviewPages } from './pdf-preview.util';

// A real 42-page PDF that already lives in the repo root, so the test needs no
// fixture of its own and exercises a genuine document rather than a stub.
const PDF_PATH = path.resolve(__dirname, '../../../../../../API_Documentation.pdf');

describe('pdf-preview.util', () => {
  let buffer: Buffer;

  beforeAll(() => {
    buffer = fs.readFileSync(PDF_PATH);
  });

  it('reads the page count without rendering', async () => {
    await expect(readPageCount(buffer)).resolves.toBe(42);
  });

  it('renders exactly the requested number of pages', async () => {
    const pages = await renderPreviewPages(buffer, 3);
    expect(pages).toHaveLength(3);
    pages.forEach((p) => expect(p.length).toBeGreaterThan(1000));
  });

  it('returns PNG buffers', async () => {
    const [first] = await renderPreviewPages(buffer, 1);
    // PNG magic number.
    expect(first.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('clamps a request for more pages than the document has', async () => {
    // An admin who types 100 for a 42-page book gets 42, not an error — the
    // form validates too, but the renderer must not throw on a stale value.
    const pages = await renderPreviewPages(buffer, 100);
    expect(pages).toHaveLength(42);
  });

  it('clamps to the shared maximum even when asked for more', async () => {
    const pages = await renderPreviewPages(buffer, 999);
    expect(pages.length).toBeLessThanOrEqual(42);
  });

  it('treats a zero or negative count as one page', async () => {
    await expect(renderPreviewPages(buffer, 0)).resolves.toHaveLength(1);
    await expect(renderPreviewPages(buffer, -5)).resolves.toHaveLength(1);
  });

  it('rejects a buffer that is not a PDF', async () => {
    await expect(readPageCount(Buffer.from('not a pdf'))).rejects.toBeDefined();
  });
}, 30_000);
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products`
Expected: FAIL — `Cannot find module './pdf-preview.util'`.

- [ ] **Step 4: Write the implementation**

Create `apps/backend/src/modules/digital-products/pdf-preview.util.ts`:

```ts
import { DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';

// pdf-to-img is ESM-only, so it is loaded through a dynamic import rather than
// a top-level require — the backend compiles to CommonJS.
async function loadPdf() {
  const mod = await import('pdf-to-img');
  return mod.pdf;
}

/** Page count without rendering anything — ~66ms on a 42-page document, so the
 * admin can validate the preview-page setting the moment a file is chosen. */
export async function readPageCount(buffer: Buffer): Promise<number> {
  const pdf = await loadPdf();
  const doc = await pdf(buffer);
  return doc.length;
}

/**
 * Renders the first `count` pages to PNG buffers.
 *
 * Runs once at upload time, never per request. Clamped on three sides: at
 * least one page, never more than the document has, never more than
 * DIGITAL_PREVIEW_PAGES_MAX — so a stale or hostile value cannot turn one
 * upload into hundreds of renders.
 */
export async function renderPreviewPages(buffer: Buffer, count: number): Promise<Buffer[]> {
  const pdf = await loadPdf();
  // scale 1.5 keeps text readable when the preview modal shows a page at
  // roughly half a screen wide; ~130KB per page.
  const doc = await pdf(buffer, { scale: 1.5 });
  const limit = Math.min(Math.max(Math.trunc(count) || 1, 1), DIGITAL_PREVIEW_PAGES_MAX, doc.length);

  const pages: Buffer[] = [];
  for await (const page of doc) {
    pages.push(page);
    if (pages.length >= limit) break;
  }
  return pages;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products --verbose`
Expected: PASS, 7 tests.

If `import('pdf-to-img')` fails under ts-jest with an ESM error, add `"pdf-to-img"` to `transformIgnorePatterns`'s exception list in `apps/backend/package.json`'s jest config and re-run. Report it either way.

---

### Task 3: Private storage and the digital-products service

**Files:**
- Modify: `apps/backend/src/modules/media/storage/media-storage.interface.ts`
- Modify: `apps/backend/src/modules/media/storage/r2-media-storage.ts`
- Create: `apps/backend/src/modules/digital-products/digital-products.service.ts`
- Test: `apps/backend/src/modules/digital-products/digital-products.service.spec.ts`

**Interfaces:**
- Consumes: `readPageCount`, `renderPreviewPages` (Task 2); `MEDIA_STORAGE` token and `MediaStorage`.
- Produces: `MediaStorage.uploadPrivate(key, body, contentType): Promise<{ key: string }>` and `MediaStorage.getObjectStream(key): Promise<Readable>`; `DigitalProductsService.attachFile(productId, file)`, `.removeFile(productId)`, `.setPreviewPages(productId, count)`.

- [ ] **Step 1: Extend the storage interface**

In `media-storage.interface.ts`:

```ts
import type { Readable } from 'node:stream';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface UploadedObject {
  url: string;
}

/** Deliberately returns the KEY and no URL. A digital product's PDF must never
 * have a public address — the bucket is wholly public, so a URL for it would be
 * fetchable by anyone forever, with no entitlement check. */
export interface PrivateObject {
  key: string;
}

export interface MediaStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<UploadedObject>;
  uploadPrivate(key: string, body: Buffer, contentType: string): Promise<PrivateObject>;
  getObjectStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
```

- [ ] **Step 2: Implement both on R2**

In `r2-media-storage.ts`, add `GetObjectCommand` to the `@aws-sdk/client-s3` import, then:

```ts
  async uploadPrivate(key: string, body: Buffer, contentType: string): Promise<PrivateObject> {
    const { client, bucket } = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // No CacheControl and no public URL returned. The object is only ever
        // read back through getObjectStream() behind an entitlement check.
        CacheControl: 'private, no-store',
      }),
    );
    return { key };
  }

  async getObjectStream(key: string): Promise<Readable> {
    const { client, bucket } = this.getClient();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return res.Body as Readable;
  }
```

Note `uploadPrivate` does not make the object private at the bucket level — the bucket is public and changing that is a migration affecting every existing image. What it does is never mint or store a public URL, so the key is not discoverable. The spec records the private-bucket upgrade path.

- [ ] **Step 3: Write the failing test**

Create `apps/backend/src/modules/digital-products/digital-products.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DigitalProductsService } from './digital-products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';

function createMockPrismaService() {
  return {
    client: {
      product: { findUnique: jest.fn(), update: jest.fn() },
      productPreviewPage: { deleteMany: jest.fn(), createMany: jest.fn() },
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

function pdfFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'my book.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fake'),
    size: 1234,
  } as Express.Multer.File;
}

jest.mock('./pdf-preview.util', () => ({
  readPageCount: jest.fn().mockResolvedValue(42),
  renderPreviewPages: jest.fn().mockResolvedValue([Buffer.from('a'), Buffer.from('b')]),
}));

describe('DigitalProductsService', () => {
  let service: DigitalProductsService;
  let prisma: MockPrisma;
  let storage: { upload: jest.Mock; uploadPrivate: jest.Mock; getObjectStream: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = {
      upload: jest.fn().mockResolvedValue({ url: 'https://cdn.test/image/p.png' }),
      uploadPrivate: jest.fn().mockImplementation((key: string) => Promise.resolve({ key })),
      getObjectStream: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigitalProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();
    service = module.get(DigitalProductsService);
    prisma.client.product.findUnique.mockResolvedValue({ id: 1, productType: 'DIGITAL', digitalPreviewPages: null });
    prisma.client.product.update.mockResolvedValue({ id: 1 });
  });

  it('stores the PDF privately and never records a public url', async () => {
    await service.attachFile(1, pdfFile());
    expect(storage.uploadPrivate).toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalledWith(
      expect.stringContaining('.pdf'), expect.anything(), 'application/pdf',
    );
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalFileKey).toMatch(/^digital\//);
    expect(saved.digitalFileKey).not.toMatch(/^https?:/);
  });

  it('sanitizes the filename so a space cannot break the key', async () => {
    await service.attachFile(1, pdfFile());
    const key = prisma.client.product.update.mock.calls[0][0].data.digitalFileKey;
    expect(key).not.toContain(' ');
    expect(key).toContain('my-book.pdf');
  });

  it('records the real page count and the original filename', async () => {
    await service.attachFile(1, pdfFile());
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalPageCount).toBe(42);
    expect(saved.digitalFileName).toBe('my book.pdf');
    expect(saved.digitalFileSize).toBe(1234);
  });

  it('uploads preview pages to the PUBLIC path — they are the free sample', async () => {
    await service.attachFile(1, pdfFile());
    expect(storage.upload).toHaveBeenCalled();
    expect(prisma.client.productPreviewPage.createMany).toHaveBeenCalled();
  });

  it('replaces previous preview pages rather than appending', async () => {
    await service.attachFile(1, pdfFile());
    expect(prisma.client.productPreviewPage.deleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  it('rejects a non-PDF', async () => {
    await expect(
      service.attachFile(1, pdfFile({ mimetype: 'image/png' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a product that is not DIGITAL', async () => {
    prisma.client.product.findUnique.mockResolvedValue({ id: 1, productType: 'PHYSICAL' });
    await expect(service.attachFile(1, pdfFile())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for a product that does not exist', async () => {
    prisma.client.product.findUnique.mockResolvedValue(null);
    await expect(service.attachFile(1, pdfFile())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-renders previews when the preview page count changes', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 42,
    });
    storage.getObjectStream.mockResolvedValue(null);
    await expect(service.setPreviewPages(1, 3)).resolves.toBeDefined();
    expect(prisma.client.product.update).toHaveBeenCalled();
  });

  it('refuses a preview count above the document page count', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 4,
    });
    await expect(service.setPreviewPages(1, 10)).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products/digital-products.service`
Expected: FAIL — `Cannot find module './digital-products.service'`.

- [ ] **Step 5: Write the service**

Create `apps/backend/src/modules/digital-products/digital-products.service.ts`. Reuse the existing `sanitizeFilename` exported from `apps/backend/src/modules/media/media.service.ts` — it was added to fix a bug where spaces in filenames produced unfetchable URLs, and the same trap applies here.

```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE, MediaStorage } from '../media/storage/media-storage.interface';
import { sanitizeFilename } from '../media/media.service';
import { DIGITAL_PREVIEW_PAGES_DEFAULT } from '@amader/shared';
import { readPageCount, renderPreviewPages } from './pdf-preview.util';

@Injectable()
export class DigitalProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Uploads the PDF privately, records its metadata, and renders the preview
   * pages. Rendering happens here, once, rather than per request. */
  async attachFile(productId: number, file: Express.Multer.File) {
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

    const previewCount = Math.min(
      product.digitalPreviewPages ?? DIGITAL_PREVIEW_PAGES_DEFAULT,
      pageCount,
    );
    await this.renderAndStorePreviews(productId, file.buffer, previewCount);

    return this.prisma.client.product.update({
      where: { id: productId },
      data: {
        digitalFileKey: key,
        digitalFileName: file.originalname,
        digitalFileSize: file.size,
        digitalPageCount: pageCount,
        digitalPreviewPages: previewCount,
      },
    });
  }

  async removeFile(productId: number) {
    const product = await this.prisma.client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.digitalFileKey) await this.storage.delete(product.digitalFileKey);
    await this.prisma.client.productPreviewPage.deleteMany({ where: { productId } });
    return this.prisma.client.product.update({
      where: { id: productId },
      data: {
        digitalFileKey: null,
        digitalFileName: null,
        digitalFileSize: null,
        digitalPageCount: null,
      },
    });
  }

  /** Changing how many pages the preview shows re-renders from the stored PDF
   * — the admin never has to re-upload to change this. */
  async setPreviewPages(productId: number, count: number) {
    const product = await this.prisma.client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.digitalFileKey) throw new BadRequestException('This product has no file yet');
    if (product.digitalPageCount && count > product.digitalPageCount) {
      throw new BadRequestException(
        `This document has only ${product.digitalPageCount} pages`,
      );
    }

    const stream = await this.storage.getObjectStream(product.digitalFileKey);
    const buffer = await streamToBuffer(stream);
    await this.renderAndStorePreviews(productId, buffer, count);

    return this.prisma.client.product.update({
      where: { id: productId },
      data: { digitalPreviewPages: count },
    });
  }

  // ------------------------------------------------------------------

  private async renderAndStorePreviews(productId: number, pdf: Buffer, count: number) {
    const pages = await renderPreviewPages(pdf, count);
    // Replace wholesale — a shorter preview must not leave stale later pages
    // visible, which would leak content the admin just decided to hide.
    await this.prisma.client.productPreviewPage.deleteMany({ where: { productId } });

    const rows: { productId: number; pageNumber: number; imageUrl: string }[] = [];
    for (const [index, page] of pages.entries()) {
      // PUBLIC on purpose: preview pages are the free sample.
      const { url } = await this.storage.upload(
        `image/preview-${productId}-${index + 1}-${randomUUID()}.png`,
        page,
        'image/png',
      );
      rows.push({ productId, pageNumber: index + 1, imageUrl: url });
    }
    if (rows.length) {
      await this.prisma.client.productPreviewPage.createMany({ data: rows });
    }
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream | null): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products --verbose`
Expected: PASS, 17 tests (7 from Task 2 plus 10 here).

---

### Task 4: Admin endpoints and module wiring

**Files:**
- Create: `apps/backend/src/modules/digital-products/admin-digital-products.controller.ts`
- Create: `apps/backend/src/modules/digital-products/dto/set-preview-pages.dto.ts`
- Create: `apps/backend/src/modules/digital-products/digital-products.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `DigitalProductsService` (Task 3).
- Produces: `POST /api/v1/admin/digital-products/:id/file`, `DELETE /api/v1/admin/digital-products/:id/file`, `PATCH /api/v1/admin/digital-products/:id/preview-pages`. Exports `DigitalProductsService` for Task 6.

- [ ] **Step 1: Write the DTO**

Create `dto/set-preview-pages.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';

export class SetPreviewPagesDto {
  @ApiProperty({ minimum: 1, maximum: DIGITAL_PREVIEW_PAGES_MAX })
  @IsInt()
  @Min(1)
  @Max(DIGITAL_PREVIEW_PAGES_MAX)
  previewPages!: number;
}
```

- [ ] **Step 2: Write the admin controller**

Copy the guard stack from `apps/backend/src/modules/products/admin-products.controller.ts` rather than trusting this snippet — confirm the real import paths for `AdminJwtGuard`, `PermissionGuard`, `RequirePermission` and `AuditLogInterceptor` from that file.

```ts
import {
  Body, Controller, Delete, Param, ParseIntPipe, Patch, Post,
  UploadedFile, UseGuards, UseInterceptors, MaxFileSizeValidator, ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { DIGITAL_FILE_MAX_BYTES } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { DigitalProductsService } from './digital-products.service';
import { SetPreviewPagesDto } from './dto/set-preview-pages.dto';

@ApiTags('admin/digital-products')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/digital-products')
export class AdminDigitalProductsController {
  constructor(private readonly digital: DigitalProductsService) {}

  // 50MB, not the media module's 20MB — a book routinely exceeds 20MB, and a
  // truncated upload is worse than a clear rejection.
  @Post(':id/file')
  @RequirePermission('digital_product.update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: DIGITAL_FILE_MAX_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.digital.attachFile(id, file);
  }

  @Delete(':id/file')
  @RequirePermission('digital_product.update')
  removeFile(@Param('id', ParseIntPipe) id: number) {
    return this.digital.removeFile(id);
  }

  @Patch(':id/preview-pages')
  @RequirePermission('digital_product.update')
  setPreviewPages(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPreviewPagesDto) {
    return this.digital.setPreviewPages(id, dto.previewPages);
  }
}
```

- [ ] **Step 3: Write the module**

```ts
import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { AdminDigitalProductsController } from './admin-digital-products.controller';
import { DigitalProductsService } from './digital-products.service';

@Module({
  // MEDIA_STORAGE is provided by MediaModule; import it rather than
  // re-providing a second R2 client.
  imports: [MediaModule],
  controllers: [AdminDigitalProductsController],
  providers: [DigitalProductsService],
  exports: [DigitalProductsService],
})
export class DigitalProductsModule {}
```

Check `apps/backend/src/modules/media/media.module.ts` actually exports `MEDIA_STORAGE`. If it does not, add it to that module's `exports` array.

- [ ] **Step 4: Register in app.module.ts**

Add the import beside the other module imports and `DigitalProductsModule,` to the `imports` array.

- [ ] **Step 5: Verify the routes are live**

Wait for `Nest application successfully started` in `backend-dev.log`, then:

```bash
curl -s -o /dev/null -w "unauth upload: %{http_code}\n" -X POST http://localhost:3000/api/v1/admin/digital-products/1/file
curl -s http://localhost:3000/api/docs-json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(Object.keys(JSON.parse(s).paths).filter(p=>/digital/.test(p)).join('\n'))})"
```

Expected: `401` for the unauthenticated call, and three `digital-products` paths listed.

Also check `backend-dev.log` for `error TS` before trusting the curl — a compile failure leaves the previous build serving.

---

### Task 5: Digital-only detection and checkout separation

**Files:**
- Create: `apps/backend/src/modules/orders/digital-order.util.ts`
- Test: `apps/backend/src/modules/orders/digital-order.util.spec.ts`
- Modify: `apps/backend/src/modules/orders/checkout.service.ts`
- Modify: `apps/backend/src/modules/cart/cart.service.ts:441`
- Modify: `apps/backend/src/modules/orders/dto/checkout.dto.ts`
- Modify: `apps/backend/src/modules/courier/shipments.service.ts` (`adminQueue`, ~line 374)

**Interfaces:**
- Consumes: `productTypeSnapshot` (Task 1).
- Produces: `isDigitalOnly(lines: { productType: string }[]): boolean` — used by Task 6.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/orders/digital-order.util.spec.ts`:

```ts
import { isDigitalOnly } from './digital-order.util';

describe('isDigitalOnly', () => {
  it('is true when every line is digital', () => {
    expect(isDigitalOnly([{ productType: 'DIGITAL' }, { productType: 'DIGITAL' }])).toBe(true);
  });

  it('is false when every line is physical', () => {
    expect(isDigitalOnly([{ productType: 'PHYSICAL' }])).toBe(false);
  });

  it('is false for a mixed cart — there is a parcel, so it behaves physically', () => {
    expect(isDigitalOnly([{ productType: 'DIGITAL' }, { productType: 'PHYSICAL' }])).toBe(false);
  });

  it('is false for an empty list rather than vacuously true', () => {
    // An empty cart must never look "digital" and skip address collection.
    expect(isDigitalOnly([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/orders/digital-order`
Expected: FAIL — module not found.

- [ ] **Step 3: Write it**

```ts
/**
 * A cart or order is "digital-only" when every line is a digital product.
 *
 * Mixed carts are deliberately NOT digital-only: there is a parcel to ship, so
 * shipping, address and the dispatch queue all still apply. An empty list is
 * false rather than vacuously true — otherwise an empty cart would skip
 * address collection.
 */
export function isDigitalOnly(lines: { productType: string }[]): boolean {
  return lines.length > 0 && lines.every((l) => l.productType === 'DIGITAL');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @amader/backend exec jest src/modules/orders/digital-order`
Expected: PASS, 4 tests.

- [ ] **Step 5: Snapshot the product type on order items**

In `checkout.service.ts`, in the `items.create` map (around line 286), add beside `skuSnapshot`:

```ts
                productTypeSnapshot: item.product.productType,
```

- [ ] **Step 6: Make shipping free for digital-only carts**

In `checkout.service.ts` around line 233, compute the flag from the cart's lines and pass it:

```ts
    // A digital-only order has nothing to ship. computeCheckoutFees already
    // early-returns 0 for freeShipping, so this needs no change to the shared
    // function and leaves the physical path untouched.
    const digitalOnly = isDigitalOnly(cart.items.map((i) => ({ productType: i.product.productType })));
    const { shippingFee } = computeCheckoutFees(
      pricing.discounts.some((d) => d.freeShipping) || digitalOnly,
      dto.shippingAddress?.district,
      await this.shippingZones.getConfig(),
    );
```

Apply the same change at `cart.service.ts:441` so the previewed total matches — that file's `serializePricing` will need the cart's product types passed in.

- [ ] **Step 7: Make the shipping address conditional**

In `dto/checkout.dto.ts`, mark `shippingAddress` optional at the DTO level:

```ts
  @ApiPropertyOptional({
    type: CheckoutAddressDto,
    description: 'Required unless every cart line is a digital product',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;
```

Then enforce it in `checkout.service.ts`, immediately after `digitalOnly` is computed:

```ts
    if (!digitalOnly && !dto.shippingAddress) {
      throw new BadRequestException('A shipping address is required');
    }
```

Every later `dto.shippingAddress.x` becomes `dto.shippingAddress?.x`. For the blocker call (~line 158), pass empty strings rather than a missing object — it is fraud protection keyed on phone, email, IP and device, all still collected, so it must keep running:

```ts
      address: dto.shippingAddress ? this.compactAddress(dto.shippingAddress) : '',
```

- [ ] **Step 8: Skip addresses and stock for digital-only orders**

The `addresses: { create: [...] }` block (lines ~296-307) becomes conditional — omit the key entirely when `digitalOnly`. Likewise wrap the `reserveStock` loop (~lines 243-250) so it does not run for a digital-only order: a PDF has no stock.

- [ ] **Step 9: Keep digital orders out of the dispatch queue**

`ShipmentsService.adminQueue()` (~line 374) currently has no status or type filter at all — it deliberately selects every non-deleted order. Add one condition to its `where`:

```ts
      // Digital-only orders have nothing to pack. The queue is a packing list,
      // so an ebook sitting in it forever is noise staff cannot action. Mixed
      // orders still appear — they contain a parcel.
      items: { some: { productTypeSnapshot: 'PHYSICAL' } },
```

- [ ] **Step 10: Verify**

```bash
pnpm --filter @amader/backend exec jest src/modules
pnpm --filter @amader/backend exec tsc --noEmit -p tsconfig.json
```

Expected: all tests pass, 0 type errors.

---

### Task 6: Entitlement, unlocking and the download endpoint

**Files:**
- Create: `apps/backend/src/modules/digital-products/downloads.service.ts`
- Create: `apps/backend/src/modules/digital-products/downloads.controller.ts`
- Test: `apps/backend/src/modules/digital-products/downloads.service.spec.ts`
- Modify: `apps/backend/src/modules/digital-products/digital-products.module.ts`
- Modify: `apps/backend/src/modules/orders/orders.service.ts` (status transition hook)

**Interfaces:**
- Consumes: `isDigitalOnly` (Task 5), `MediaStorage.getObjectStream` (Task 3).
- Produces: `DownloadsService.createForOrder(orderId)`, `.unlockForOrder(orderId)`, `.streamByToken(token)`, `.listForCustomer(customerId)`. Endpoints `GET /api/v1/downloads/:token` and `GET /api/v1/customers/me/downloads`.

- [ ] **Step 1: Write the failing test**

Create `downloads.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';

function createMockPrismaService() {
  return {
    client: {
      order: { findUnique: jest.fn() },
      digitalDownload: {
        createMany: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };
}

describe('DownloadsService', () => {
  let service: DownloadsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: { getObjectStream: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = { getObjectStream: jest.fn().mockResolvedValue('STREAM') };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();
    service = module.get(DownloadsService);
  });

  it('creates one locked download per digital line', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7, customerId: 3,
      items: [
        { productId: 10, productTypeSnapshot: 'DIGITAL' },
        { productId: 11, productTypeSnapshot: 'PHYSICAL' },
      ],
    });
    await service.createForOrder(7);
    const rows = prisma.client.digitalDownload.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBe(10);
    // Locked until payment is confirmed.
    expect(rows[0].unlockedAt).toBeNull();
    expect(rows[0].token).toEqual(expect.any(String));
    expect(rows[0].token.length).toBeGreaterThanOrEqual(32);
  });

  it('creates nothing for an order with no digital lines', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 8, customerId: null, items: [{ productId: 11, productTypeSnapshot: 'PHYSICAL' }],
    });
    await service.createForOrder(8);
    expect(prisma.client.digitalDownload.createMany).not.toHaveBeenCalled();
  });

  it('unlocks every download on the order', async () => {
    await service.unlockForOrder(7);
    expect(prisma.client.digitalDownload.updateMany).toHaveBeenCalledWith({
      where: { orderId: 7, unlockedAt: null },
      data: { unlockedAt: expect.any(Date) },
    });
  });

  it('streams a valid unlocked token and counts the download', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: new Date(), downloadCount: 2,
      product: { digitalFileKey: 'digital/a.pdf', digitalFileName: 'book.pdf' },
    });
    const res = await service.streamByToken('tok');
    expect(res.filename).toBe('book.pdf');
    expect(storage.getObjectStream).toHaveBeenCalledWith('digital/a.pdf');
    expect(prisma.client.digitalDownload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ downloadCount: 3 }) }),
    );
  });

  it('refuses a locked token', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: null, product: { digitalFileKey: 'digital/a.pdf' },
    });
    await expect(service.streamByToken('tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s an unknown token', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue(null);
    await expect(service.streamByToken('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the product has lost its file', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: new Date(), product: { digitalFileKey: null },
    });
    await expect(service.streamByToken('tok')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only unlocked downloads for a customer', async () => {
    prisma.client.digitalDownload.findMany.mockResolvedValue([]);
    await service.listForCustomer(3);
    expect(prisma.client.digitalDownload.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 3, unlockedAt: { not: null } } }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products/downloads`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

```ts
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE, MediaStorage } from '../media/storage/media-storage.interface';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** One locked entitlement per digital line, created when the order is placed.
   * Locked because the buyer has not paid yet — see unlockForOrder. */
  async createForOrder(orderId: number): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const digitalLines = order.items.filter((i) => i.productTypeSnapshot === 'DIGITAL');
    if (digitalLines.length === 0) return;

    await this.prisma.client.digitalDownload.createMany({
      data: digitalLines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        customerId: order.customerId,
        // 48 hex chars. Emailed, so it must be unguessable on its own — it is
        // the only credential a guest presents.
        token: randomBytes(24).toString('hex'),
        unlockedAt: null,
      })),
    });
  }

  /** Called on payment confirmation — immediately for a ৳0 order, and when
   * staff verify a manual bKash payment otherwise. Swapping in a real gateway
   * later changes only who calls this. */
  async unlockForOrder(orderId: number): Promise<void> {
    await this.prisma.client.digitalDownload.updateMany({
      where: { orderId, unlockedAt: null },
      data: { unlockedAt: new Date() },
    });
  }

  async streamByToken(token: string) {
    const download = await this.prisma.client.digitalDownload.findUnique({
      where: { token },
      include: { product: true },
    });
    if (!download) throw new NotFoundException('Download not found');
    if (!download.unlockedAt) {
      throw new ForbiddenException(
        'This download unlocks once your payment is confirmed.',
      );
    }
    if (!download.product.digitalFileKey) throw new NotFoundException('File is no longer available');

    await this.prisma.client.digitalDownload.update({
      where: { id: download.id },
      data: { downloadCount: download.downloadCount + 1, lastDownloadAt: new Date() },
    });

    return {
      stream: await this.storage.getObjectStream(download.product.digitalFileKey),
      filename: download.product.digitalFileName ?? 'download.pdf',
    };
  }

  listForCustomer(customerId: number) {
    return this.prisma.client.digitalDownload.findMany({
      where: { customerId, unlockedAt: { not: null } },
      include: { product: { include: { translations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @amader/backend exec jest src/modules/digital-products/downloads --verbose`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the controller**

```ts
import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { DownloadsService } from './downloads.service';

@ApiTags('downloads')
@Controller()
export class DownloadsController {
  constructor(private readonly downloads: DownloadsService) {}

  // Token-gated rather than session-gated, so the emailed link works for a
  // buyer who never signs in.
  @Get('downloads/:token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const { stream, filename } = await this.downloads.streamByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    stream.pipe(res);
  }
}
```

Add a second, session-guarded route for `customers/me/downloads`. Copy the guard from `apps/backend/src/modules/customers/customers.controller.ts` — confirm the real class name (`CustomerJwtGuard`) and how the customer id is read off the request there.

- [ ] **Step 6: Hook creation and unlocking into the order lifecycle**

In `checkout.service.ts`, after the order transaction commits, call `downloads.createForOrder(order.id)`. Then, still in `checkout()`, for a **digital-only, ৳0** order: unlock immediately and complete the order.

```ts
    // A free digital order has no payment step, so it is already "paid".
    // Completing it matters beyond tidiness: profit.service.ts computes profit
    // ONLY on the transition to COMPLETED, so an order that never completes is
    // invisible in Net Profit while still showing in Order Manager.
    if (digitalOnly && totalAmount.equals(0)) {
      await this.downloads.unlockForOrder(order.id);
      await this.orders.updateStatus(
        order.id,
        { status: 'COMPLETED', note: 'Free digital order — delivered instantly' },
        null, // system-triggered, same convention as the courier webhook
      );
    }
```

For **priced** orders, unlocking happens when staff confirm the payment. Find where manual payment verification transitions an order (search `payments`/`order-manager` for the confirm action) and call `unlockForOrder(orderId)` there. If no single such place exists, hook `ORDER_STATUS_CHANGED_EVENT` and unlock on transition to `CONFIRMED` or `COMPLETED` — and say in your report which you did and why.

- [ ] **Step 7: Wire the module and verify**

Add `DownloadsService` and `DownloadsController` to `DigitalProductsModule`, and whatever module provides the orders service that Step 6 uses.

```bash
pnpm --filter @amader/backend exec jest src/modules
curl -s -o /dev/null -w "unknown token: %{http_code}\n" http://localhost:3000/api/v1/downloads/doesnotexist
```

Expected: all tests pass; the unknown token returns 404.

---

### Task 7: Account creation at checkout

**Files:**
- Create: `apps/backend/src/modules/orders/checkout-account.service.ts`
- Test: `apps/backend/src/modules/orders/checkout-account.service.spec.ts`
- Modify: `apps/backend/src/modules/orders/checkout.service.ts`
- Modify: `apps/backend/src/modules/orders/dto/checkout.dto.ts`

**Interfaces:**
- Consumes: `TokenService.signCustomerTokens(customerId)`.
- Produces: `CheckoutAccountService.ensureAccount(input): Promise<{ customerId: number; tokens: TokenPair | null; existingAccount: boolean }>`.

**This is the security-critical task.** Read the spec's "Account creation at checkout" section before starting.

- [ ] **Step 1: Write the failing test**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutAccountService } from './checkout-account.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';

function createMockPrismaService() {
  return { client: { customer: { findFirst: jest.fn(), create: jest.fn() } } };
}

describe('CheckoutAccountService', () => {
  let service: CheckoutAccountService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let tokens: { signCustomerTokens: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    tokens = { signCustomerTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutAccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(CheckoutAccountService);
  });

  const input = { firstName: 'A', lastName: 'B', email: 'new@test.com', phone: '8801711111111' };

  it('creates an account and issues a session for a brand-new buyer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    const res = await service.ensureAccount(input);
    expect(res.customerId).toBe(5);
    expect(res.tokens).not.toBeNull();
    expect(res.existingAccount).toBe(false);
  });

  it('creates the account with NO password', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    await service.ensureAccount(input);
    const data = prisma.client.customer.create.mock.calls[0][0].data;
    expect(data.passwordHash ?? null).toBeNull();
  });

  // THE security test. Without this, anyone could place a ৳0 order using a
  // customer's email and be logged into that customer's account.
  it('does NOT issue a session when the email belongs to a verified customer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 9, emailVerifiedAt: new Date() });
    const res = await service.ensureAccount(input);
    expect(res.customerId).toBe(9);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
    expect(tokens.signCustomerTokens).not.toHaveBeenCalled();
  });

  it('does NOT issue a session when the phone belongs to a verified customer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 9, phoneVerifiedAt: new Date() });
    const res = await service.ensureAccount(input);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
  });

  it('never creates a duplicate when a match exists', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 9, emailVerifiedAt: new Date() });
    await service.ensureAccount(input);
    expect(prisma.client.customer.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/orders/checkout-account`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';

export interface EnsureAccountInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

@Injectable()
export class CheckoutAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Creates a passwordless account for a digital-product buyer and logs them in.
   *
   * Passwordless account-creation-plus-session is an established pattern here —
   * `otp/verify` with purpose REGISTER and `socialLogin` both do exactly this.
   *
   * THE RULE THAT MATTERS: if the email or phone already belongs to a VERIFIED
   * customer, no session is issued. Otherwise anyone could place a ৳0 order
   * using someone else's email and land inside their account, with their order
   * history and saved addresses. The purchase is still attached to the right
   * customer — they just have to sign in to collect it.
   */
  async ensureAccount(input: EnsureAccountInput) {
    const existing = await this.prisma.client.customer.findFirst({
      where: {
        OR: [
          ...(input.email ? [{ email: input.email, emailVerifiedAt: { not: null } }] : []),
          ...(input.phone ? [{ phone: input.phone, phoneVerifiedAt: { not: null } }] : []),
        ],
      },
    });

    if (existing) {
      return { customerId: existing.id, tokens: null, existingAccount: true };
    }

    const customer = await this.prisma.client.customer.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        // No password. POST /customers/me/password already lets them set one
        // later, and it only works while the hash is null — so no
        // password-reset email flow is needed.
        emailVerifiedAt: input.email ? new Date() : null,
        phoneVerifiedAt: null,
      },
    });

    return {
      customerId: customer.id,
      tokens: await this.tokens.signCustomerTokens(customer.id),
      existingAccount: false,
    };
  }
}
```

Open `apps/backend/src/modules/auth/customer-auth.service.ts:229-241` first and mirror the exact fields its bare-create uses — that is the working precedent, and this must not diverge from it.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @amader/backend exec jest src/modules/orders/checkout-account --verbose`
Expected: PASS, 6 tests.

- [ ] **Step 5: Call it from checkout**

Add optional `createAccount` fields to `CheckoutDto` (firstName, lastName, email, phone). In `checkout()`, when the cart is digital-only and there is no `identity.customerId`, call `ensureAccount` before creating the order, set `customerId` from the result, and return `tokens` and `existingAccount` on the checkout response so the web app can set cookies and choose where to send the buyer.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @amader/backend exec jest src/modules
pnpm --filter @amader/backend exec tsc --noEmit -p tsconfig.json
```

---

### Task 8: Admin Digital Products section

**Files:**
- Create: `apps/admin/src/hooks/useDigitalProducts.ts`
- Create: `apps/admin/src/app/(shell)/digital-products/page.tsx`
- Create: `apps/admin/src/app/(shell)/digital-products/new/page.tsx`
- Create: `apps/admin/src/app/(shell)/digital-products/[id]/page.tsx`
- Create: `apps/admin/src/components/digital-products/DigitalFileCard.tsx`
- Modify: `apps/admin/src/lib/nav-config.tsx`
- Modify: `apps/admin/src/lib/api/schema.d.ts` (regenerated)

**Interfaces:**
- Consumes: the Task 4 endpoints; `DIGITAL_PREVIEW_PAGES_DEFAULT`, `DIGITAL_FILE_MAX_BYTES` from `@amader/shared`.
- Produces: nothing downstream.

- [ ] **Step 1: Regenerate types**

```bash
pnpm --filter @amader/admin typegen
grep -c "digital" apps/admin/src/lib/api/schema.d.ts
```

- [ ] **Step 2: Write the hook**

Follow `apps/admin/src/hooks/useProducts.ts` for shape. It needs: a list query filtered to `productType=DIGITAL`, an upload mutation posting `multipart/form-data` to `/admin/digital-products/{id}/file`, a delete-file mutation, and a set-preview-pages mutation.

`proxyFetch` sets `Content-Type: application/json`, which breaks multipart. For the upload, call `fetch('/api/backend/admin/digital-products/${id}/file', { method: 'POST', body: formData })` directly and let the browser set the boundary — check how `useUploadMedia` in `apps/admin/src/hooks/useMedia.ts` already handles this and copy it.

- [ ] **Step 3: Build the Digital File card**

`DigitalFileCard.tsx` — the one genuinely new piece of UI:

- Drop zone / file input with `accept="application/pdf"`, rejecting over `DIGITAL_FILE_MAX_BYTES` client-side with a clear message
- After upload: filename, size, and detected page count, read-only
- Preview pages number input, defaulting to `DIGITAL_PREVIEW_PAGES_DEFAULT`, `max` bound to the detected page count, saving via the preview-pages mutation
- A thumbnail strip of the rendered preview images, so the admin sees exactly what customers will see
- Replace / Remove buttons

- [ ] **Step 4: Build the three routes**

List, new and edit. Reuse `useProductFormState` for all the shared product fields rather than forking it. Render the General, Media, SEO and Analytics tabs, and replace Inventory / Variants / Shipping with the Digital File card — a PDF has no stock, no variants and no weight, and `ProductFormFields.tsx` has no seam for conditionally hiding them.

Creating from this section must set `productType: 'DIGITAL'`.

- [ ] **Step 5: Add the nav entry**

In `apps/admin/src/lib/nav-config.tsx`, in the Product Management group, directly after the `products` entry:

```tsx
  { key: "digital-products", label: "Digital Products", href: "/digital-products", icon: digitalProductsIcon, permission: "digital_product.view" },
```

Declare `digitalProductsIcon` with the other icon consts using a name that exists in `packages/admin-ui/src/components/Icon.tsx` — read that file, do not guess.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @amader/admin exec tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/" | grep "error TS" || echo "0 source errors"
```

Then in a browser at `http://localhost:3004/digital-products`: create a digital product, upload a PDF, confirm the page count appears and preview thumbnails render, change the preview page count and confirm the thumbnails change, and confirm the API rejects a preview count above the real page count.

---

### Task 9: Storefront — checkout signup and the downloads page

**Files:**
- Create: `apps/web/src/app/[locale]/account/downloads/page.tsx`
- Create: `apps/web/src/components/DownloadsList.tsx`
- Create: `apps/web/src/hooks/useDownloads.ts`
- Modify: `apps/web/src/components/CheckoutForm.tsx`
- Modify: `apps/web/src/lib/checkout-schema.ts`
- Modify: `apps/web/src/components/AccountNav.tsx`
- Modify: `apps/web/src/lib/api/schema.d.ts` (regenerated)

**Interfaces:**
- Consumes: the Task 6 and Task 7 endpoints.
- Produces: nothing downstream.

- [ ] **Step 1: Regenerate types**

```bash
pnpm --filter @amader/web typegen
```

- [ ] **Step 2: Make the address conditional in the form schema**

`makeCheckoutFormSchema` gains a `digitalOnly` parameter. When true, `shippingAddress` is not required and the form collects first name, last name, email and phone instead. Mirror the existing conditional-email pattern in that file rather than inventing a new one.

- [ ] **Step 3: Adapt the checkout form**

When the cart is digital-only: hide the Shipping Address and Billing Address cards, hide the shipping-rates notice, show a compact "Your details" card (first name, last name, email, phone) and — for a logged-out buyer — the line "We'll create your account so you can download anytime."

For a ৳0 total, the button reads "Get it free" rather than "Place Order"; otherwise it shows the price.

- [ ] **Step 4: Handle the response**

On success, if the response carries tokens, the web app's checkout route handler sets the auth cookies exactly as `proxyTokenIssuingCall` does for login (`apps/web/src/lib/auth-proxy.ts`) — read that helper and reuse it rather than writing cookie code by hand. Then redirect to `/account/downloads`.

If `existingAccount` is true, do **not** set cookies. Redirect to the order-confirmation page showing: "This email already has an account. We've emailed your download link — sign in to see all your downloads."

- [ ] **Step 5: Build the downloads page**

`/account/downloads` follows the established account pattern: a thin `page.tsx` rendering a client component that calls `proxyFetch` through `/api/backend`, with `AccountShell` handling the auth redirect. List each download with cover, title, purchase date, download count and a button linking to `/api/v1/downloads/{token}`. Add the nav entry to `AccountNav`.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @amader/web exec tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/" | grep "error TS" || echo "0 source errors"
```

Browser, end to end: add a ৳0 digital product to an empty cart, confirm the checkout form shows no address fields and no shipping fee, place the order, confirm you land logged-in on `/account/downloads`, and confirm the file downloads. Then repeat with an email that already belongs to a verified customer and confirm you are **not** logged in.

---

### Task 10: Download email

**Files:**
- Modify: `packages/db/seed-email-templates.sql` (or wherever templates are seeded)
- Modify: `apps/backend/src/modules/order-emails/` (the order-confirmation path)

**Interfaces:**
- Consumes: `DownloadsService` tokens (Task 6).
- Produces: nothing downstream.

- [ ] **Step 1: Add the template**

Add a `digital_download` template alongside the existing seeded set, with `{{customerName}}`, `{{productName}}` and `{{downloadUrl}}` placeholders, so the wording stays admin-editable in Settings → Email Templates. Read one existing template row first and match its structure exactly.

- [ ] **Step 2: Send it on unlock**

In `DownloadsService.unlockForOrder`, after unlocking, send one email per newly unlocked download with `downloadUrl = ${STOREFRONT_BASE_URL}/api/v1/downloads/${token}`. Use the same `EmailTemplatesService.render` + `SmtpEmailProvider.send` pair `checkout.service.ts` already uses for the COD OTP email.

Sending must not fail the unlock — wrap it so an SMTP outage cannot leave a paid customer locked out. Log the failure.

- [ ] **Step 3: Verify**

Place a free digital order and confirm the email is queued with a working link. Check `sms_logs`/email logs or the dev SMTP output, whichever this project uses.

---

## Final verification

- [ ] `pnpm --filter @amader/backend exec jest src/modules` — all pass, including the 4 new suites.
- [ ] `tsc --noEmit` clean for `@amader/backend`, `@amader/ui`, `@amader/web`, `@amader/admin`.
- [ ] A digital-only order: no `OrderAddress` rows, `shippingAmount` is 0, absent from the Shipments queue, present in Order Manager.
- [ ] A ৳0 digital order reaches `COMPLETED` and appears in Net Profit.
- [ ] A mixed cart still charges shipping and still appears in the Shipments queue.
- [ ] The PDF is not fetchable by URL — confirm no public URL for it exists anywhere in the API responses or the database.
- [ ] Checkout with an existing verified email issues no session.
- [ ] Append a summary to `bug-fix-and-feature-edit.md` at the repo parent, per the standing instruction.
