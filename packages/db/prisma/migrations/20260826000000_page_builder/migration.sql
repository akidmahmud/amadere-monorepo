-- Page builder (Puck): page kind, per-locale layout documents, publish history.
-- Plan: docs/PAGE-BUILDER-PLAN.md §5.1
--
-- Written by hand rather than generated. `prisma migrate dev` cannot run in
-- this repo: replaying the history onto a fresh shadow database fails at
-- 20260807103916_promo_videos_standalone with a foreign key violation
-- (promo_videos.product_id = 68 has no matching products row). That is a
-- pre-existing fault in the recorded history, unrelated to this change;
-- `migrate deploy` does not use a shadow database and is unaffected.
--
-- Purely additive and safe on a populated table: every new column is either
-- nullable or has a default, and no existing row changes meaning. Existing
-- pages get kind = 'CONTENT' and layout = NULL, which is exactly the state
-- the storefront already treats as "render the legacy HTML".

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('CONTENT', 'CHECKOUT');

-- AlterTable
ALTER TABLE "pages"
  ADD COLUMN "kind" "PageKind" NOT NULL DEFAULT 'CONTENT',
  ADD COLUMN "is_default_checkout" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- `content` is deliberately untouched and is never dropped: it is the
-- rendering fallback whenever `layout` is null or fails validation.
ALTER TABLE "page_translations"
  ADD COLUMN "layout" JSONB,
  ADD COLUMN "draft_layout" JSONB;

-- CreateTable
CREATE TABLE "page_revisions" (
    "id" SERIAL NOT NULL,
    "page_id" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "layout" JSONB NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_revisions_page_id_locale_created_at_idx"
  ON "page_revisions"("page_id", "locale", "created_at");

-- AddForeignKey
ALTER TABLE "page_revisions"
  ADD CONSTRAINT "page_revisions_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No DB-level "only one live checkout" constraint on purpose. Postgres can
-- express it as a partial unique index, but schema.prisma cannot, so it would
-- register as permanent drift against every future `prisma migrate diff`.
-- The service clears the flag on all other pages inside the same transaction
-- (plan §6.2.4), which is where the guarantee lives.
