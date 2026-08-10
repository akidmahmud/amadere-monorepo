-- CreateEnum
CREATE TYPE "PromoVideoSource" AS ENUM ('YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'CUSTOM_URL', 'R2', 'GIF');

-- CreateTable
CREATE TABLE "promo_videos" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "source" "PromoVideoSource" NOT NULL,
    "url" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "thumbnail_url" TEXT,
    "product_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_in_homepage" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_videos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "promo_videos" ADD CONSTRAINT "promo_videos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: PROMO_VIDEO was a HomepageSection config blob (one row,
-- config.videos[] with 2 real entries) before promo videos got their own
-- fixed homepage slot and their own table. Both entries carried forward
-- here, in the order they're actually shown on the live site today
-- (matched by YouTube video ID against the storefront's rendered order,
-- not the JSON array order, which was reversed).
INSERT INTO "promo_videos" ("title", "source", "url", "duration_seconds", "thumbnail_url", "product_id", "sort_order", "show_in_homepage", "updated_at")
VALUES
  ('Amader Box – ৫০০ টাকায় ৭টি স্বাস্থ্যকর খাবার', 'YOUTUBE', 'https://youtube.com/shorts/2YgJ-Zf05Yc?si=JEa5MREP_exQd-V8', 28, 'https://pub-51174804638049198acba5bbf211435e.r2.dev/legacy/amader-box/9d4d038b-6b53-4a24-8b41-6f5dc20dadbb.webp', 68, 0, true, CURRENT_TIMESTAMP),
  ('Amader Ganjia Full Fiber Red Rice', 'YOUTUBE', 'https://www.youtube.com/watch?v=F1EToVE8DrA', 35, 'https://pub-51174804638049198acba5bbf211435e.r2.dev/legacy/sunflower-seed/94fb87bb-91ff-4b06-a290-4bfde174f495.webp', 77, 1, true, CURRENT_TIMESTAMP);

-- Drop the old PROMO_VIDEO homepage-section row now that its data lives in
-- promo_videos — must happen before the enum swap below, since Postgres
-- can't cast a value to a new enum type that no longer has it. Cascades to
-- homepage_section_translations via the existing onDelete: Cascade FK.
DELETE FROM "homepage_sections" WHERE "type" = 'PROMO_VIDEO';

-- AlterEnum
BEGIN;
CREATE TYPE "HomepageSectionType_new" AS ENUM ('HERO_BANNER', 'PRODUCT_COLLECTION', 'BANNER_STRIP', 'CATEGORY_SHOWCASE', 'BLOG_TEASER', 'CERTIFICATION_ROW', 'TESTIMONIAL_BENTO', 'CIRCLE_BADGE_BAR', 'TABBED_COLLECTION_CAROUSEL', 'AD_BANNER', 'FEATURED_CATEGORIES', 'TOP_SELLING_PRODUCTS', 'JUST_FOR_YOU', 'FEATURED_DEALS');
ALTER TABLE "homepage_sections" ALTER COLUMN "type" TYPE "HomepageSectionType_new" USING ("type"::text::"HomepageSectionType_new");
ALTER TYPE "HomepageSectionType" RENAME TO "HomepageSectionType_old";
ALTER TYPE "HomepageSectionType_new" RENAME TO "HomepageSectionType";
DROP TYPE "public"."HomepageSectionType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "SeoEntityType" ADD VALUE 'PROMO_VIDEO';
