-- Swap FEATURE_TILES out for TABBED_COLLECTION_CAROUSEL on HomepageSectionType.
-- Postgres has no direct "DROP VALUE" for enums, so this recreates the type
-- (the standard Prisma-generated pattern for enum value removal). Safe here:
-- confirmed zero rows use 'FEATURE_TILES' before writing this migration.
BEGIN;

CREATE TYPE "HomepageSectionType_new" AS ENUM (
  'HERO_BANNER',
  'PRODUCT_COLLECTION',
  'BANNER_STRIP',
  'CATEGORY_SHOWCASE',
  'BLOG_TEASER',
  'CERTIFICATION_ROW',
  'TESTIMONIAL_BENTO',
  'CIRCLE_BADGE_BAR',
  'PROMO_VIDEO',
  'TABBED_COLLECTION_CAROUSEL'
);

ALTER TABLE "homepage_sections"
  ALTER COLUMN "type" TYPE "HomepageSectionType_new"
  USING ("type"::text::"HomepageSectionType_new");

ALTER TYPE "HomepageSectionType" RENAME TO "HomepageSectionType_old";
ALTER TYPE "HomepageSectionType_new" RENAME TO "HomepageSectionType";
DROP TYPE "HomepageSectionType_old";

COMMIT;
