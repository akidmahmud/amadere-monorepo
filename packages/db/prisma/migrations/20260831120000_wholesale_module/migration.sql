-- Wholesale: bulk orders placed by hand in the admin for shops we sell to.
--
-- These are deliberately NOT rows in `orders`/`customers`. The Order Manager
-- and the Customers pages read those two tables, so keeping wholesale in its
-- own tables is what guarantees a wholesale sale never appears there -- no
-- filter to remember, nothing to get wrong later.
--
-- The buyer is an existing `parties` row (role CUSTOMER), not a new customer
-- table: parties already carries the wholesale credit-terms columns
-- (credit_limit / credit_days, added as a Phase 2 hook) and is what the
-- ledger, dues and party statements are keyed on. That is also how the money
-- reaches Accounts -- see the dues.wholesale_order_id column below.
--
-- Hand-written + `migrate deploy`, per this repo's convention: `prisma
-- migrate dev` cannot run here (pre-existing FK violation in
-- 20260807103916_promo_videos_standalone).

CREATE TYPE "WholesaleOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED');

-- Separate from "CourierProviderName": those are API-integrated retail
-- couriers that book their own consignments. Wholesale ships by the couriers
-- used for bulk, and the consignment number is typed in from the counterfoil.
CREATE TYPE "WholesaleCourier" AS ENUM ('SUNDARBAN', 'AJR');

CREATE TABLE "wholesale_orders" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "party_id" INTEGER NOT NULL,
    "status" "WholesaleOrderStatus" NOT NULL DEFAULT 'PENDING',
    "courier" "WholesaleCourier" NOT NULL,
    "consignment_id" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "delivery_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "placed_at" DATE NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wholesale_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "variant_id" INTEGER,
    "name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "wholesale_order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wholesale_orders_order_number_key" ON "wholesale_orders"("order_number");
CREATE INDEX "wholesale_orders_party_id_idx" ON "wholesale_orders"("party_id");
CREATE INDEX "wholesale_orders_status_idx" ON "wholesale_orders"("status");
CREATE INDEX "wholesale_orders_placed_at_idx" ON "wholesale_orders"("placed_at");
CREATE INDEX "wholesale_order_items_order_id_idx" ON "wholesale_order_items"("order_id");
CREATE INDEX "wholesale_order_items_product_id_idx" ON "wholesale_order_items"("product_id");

ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_party_id_fkey"
    FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cascade: an order's own lines have no meaning without it.
ALTER TABLE "wholesale_order_items" ADD CONSTRAINT "wholesale_order_items_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "wholesale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, exactly like order_items: deleting a product must not delete the
-- history of having sold it. name_snapshot/sku_snapshot keep the line readable.
ALTER TABLE "wholesale_order_items" ADD CONSTRAINT "wholesale_order_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wholesale_order_items" ADD CONSTRAINT "wholesale_order_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- How wholesale money reaches Accounts. Each order raises one receivable
-- (source WHOLESALE_INVOICE, which the DueSource enum already carried); every
-- payment against it is a ledger entry on that due, so sales, collections and
-- outstanding balances report through the existing Accounts pages with no
-- separate wholesale reporting path to keep in sync.
--
-- SET NULL rather than CASCADE: deleting an order must never silently delete
-- the money already booked against it.
ALTER TABLE "dues" ADD COLUMN "wholesale_order_id" INTEGER;
CREATE INDEX "dues_wholesale_order_id_idx" ON "dues"("wholesale_order_id");
ALTER TABLE "dues" ADD CONSTRAINT "dues_wholesale_order_id_fkey"
    FOREIGN KEY ("wholesale_order_id") REFERENCES "wholesale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
