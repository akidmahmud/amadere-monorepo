-- The free preview becomes an explicit page RANGE (start..end) instead of a
-- count taken from the front of the document. A book's first pages are
-- usually a cover, a copyright notice and a blank leaf, so "the first N
-- pages" showed the buyer nothing worth reading.
--
-- Hand-split into ADD / BACKFILL / DROP rather than the single ALTER that
-- `prisma migrate diff` emits, so no existing row loses its setting. Prisma's
-- generated statement drops digital_preview_pages in the same ALTER that adds
-- the new columns, which would silently reset every configured product to
-- NULL. Everything else about the end state is byte-identical to that diff.

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "digital_preview_start_page" INTEGER,
ADD COLUMN     "digital_preview_end_page" INTEGER;

-- Backfill: the old column meant "the first N pages", i.e. the range 1..N.
-- LEAST(..., digital_page_count) guards the one inconsistent case the old
-- schema allowed — a stored count larger than the document itself (the count
-- was clamped on write, but nothing re-clamped it if the file was replaced by
-- a shorter one). COALESCE keeps a row with no page count from becoming NULL.
UPDATE "products"
SET "digital_preview_start_page" = 1,
    "digital_preview_end_page" = LEAST(
      "digital_preview_pages",
      COALESCE("digital_page_count", "digital_preview_pages")
    )
WHERE "digital_preview_pages" IS NOT NULL;

-- DropColumn
ALTER TABLE "products" DROP COLUMN "digital_preview_pages";
