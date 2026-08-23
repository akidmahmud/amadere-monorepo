-- Authors (a reusable record, not free text per book), the fixed book
-- "Specification" columns, and an explicit display order for the manual
-- related-products picker.
--
-- Generated with `prisma migrate diff --from-config-datasource --to-schema`
-- rather than `prisma migrate dev`: the shadow-DB replay every `migrate dev`
-- does still dies on 20260807103916_promo_videos_standalone, which INSERTs
-- hardcoded product ids against an FK (see the SDD ledger). The diff below is
-- byte-for-byte what Prisma itself emits and is purely additive — no DROP, no
-- rewrite of an existing column — so unlike 20260823000000_digital_preview_range
-- it needs no hand-splitting.
--
-- position defaults to 0, so every existing CROSS_SELL / FREQUENTLY_BOUGHT_
-- TOGETHER row keeps its current (insertion-order) behaviour untouched.

-- AlterTable
ALTER TABLE "product_relations" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_translations" ADD COLUMN     "book_country" TEXT,
ADD COLUMN     "book_edition" TEXT,
ADD COLUMN     "book_language" TEXT,
ADD COLUMN     "book_publisher" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "author_id" INTEGER,
ADD COLUMN     "isbn" TEXT;

-- CreateTable
CREATE TABLE "authors" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "photo_url" TEXT,
    "social_links" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_translations" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,

    CONSTRAINT "author_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "authors_slug_key" ON "authors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "author_translations_author_id_locale_key" ON "author_translations"("author_id", "locale");

-- AddForeignKey
ALTER TABLE "author_translations" ADD CONSTRAINT "author_translations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

