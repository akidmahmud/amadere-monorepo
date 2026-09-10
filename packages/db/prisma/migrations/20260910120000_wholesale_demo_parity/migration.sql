-- Wholesale/cash-sale rebuild, part 2: the pieces the create-order screen needs.

-- The couriers and channels the prototype actually offers. Purely additive --
-- SUNDARBAN/AJR and the six existing channels keep their meaning, so no row
-- has to be rewritten.
ALTER TYPE "WholesaleCourier" ADD VALUE IF NOT EXISTS 'SA_PARIBAHAN';
ALTER TYPE "WholesaleCourier" ADD VALUE IF NOT EXISTS 'OWN_TRANSPORT';
ALTER TYPE "WholesaleCourier" ADD VALUE IF NOT EXISTS 'CUSTOMER_PICKUP';
ALTER TYPE "WholesaleCourier" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "WholesaleOrderChannel" ADD VALUE IF NOT EXISTS 'TELEMARKETING';
ALTER TYPE "WholesaleOrderChannel" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "WholesaleOrderChannel" ADD VALUE IF NOT EXISTS 'TIKTOK';
ALTER TYPE "WholesaleOrderChannel" ADD VALUE IF NOT EXISTS 'MARKETPLACE';

-- The buyer's own address detail, so selecting a customer can fill the
-- delivery card. `address` already lived here; these are the rest of it.
ALTER TABLE "parties"
  ADD COLUMN "alternative_phone" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "thana" TEXT,
  ADD COLUMN "landmark" TEXT,
  ADD COLUMN "post_code" TEXT;

-- The bulk rate, alongside the retail price it sits next to. Nullable: a
-- variant without one falls back to its retail price, which is what every
-- product does today.
ALTER TABLE "product_variants" ADD COLUMN "wholesale_price" DECIMAL(10,2);
-- And on the product, next to the price/sale_price a simple (non-variant)
-- product already keeps here. Without this, the 27 products that sell without
-- variants would have nowhere to put a bulk rate at all.
ALTER TABLE "products" ADD COLUMN "wholesale_price" DECIMAL(10,2);
