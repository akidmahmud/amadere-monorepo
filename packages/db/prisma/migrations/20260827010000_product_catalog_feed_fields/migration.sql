-- Catalog feed fields (Meta / Google Merchant Center / TikTok).
-- Hand-written and applied with `migrate deploy`: `prisma migrate dev` cannot
-- run in this repo (the pre-existing FK violation in
-- 20260807103916_promo_videos_standalone fails the shadow database).
ALTER TABLE "products" ADD COLUMN "google_product_category" TEXT;
ALTER TABLE "products" ADD COLUMN "custom_labels" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "exclude_from_feed" BOOLEAN NOT NULL DEFAULT false;
