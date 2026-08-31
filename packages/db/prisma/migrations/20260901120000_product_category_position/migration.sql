-- Per-category product priority.
--
-- Categories had no curated order: the storefront's Default sort fell back to
-- newest-first because nothing said which product should lead a category.
-- `Product.sort_order` could not answer that — it is a single global rank, and
-- the same product legitimately ranks differently in two categories.
--
-- Defaults to 0 for every existing row, so nothing reorders until an admin
-- actually sets a priority; ties fall back to newest, which is the order the
-- storefront already showed.
ALTER TABLE "product_categories" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "product_categories_category_id_position_idx" ON "product_categories"("category_id", "position");
