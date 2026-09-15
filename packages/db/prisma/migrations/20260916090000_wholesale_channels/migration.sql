-- Wholesale sales channels. Cash Sale stops being a hardcoded order type and
-- becomes the first admin-managed channel; Daraz, Cartup, etc. are added in
-- Channel Settings, each with its own extra fields.

-- CASH_SALE -> CHANNEL. A rename keeps every existing row valid.
ALTER TYPE "WholesaleOrderType" RENAME VALUE 'CASH_SALE' TO 'CHANNEL';

CREATE TYPE "WholesalePriceList" AS ENUM ('RETAIL', 'WHOLESALE');

ALTER TYPE "WholesaleCourier" ADD VALUE 'CHANNEL_DELIVERY';
ALTER TYPE "WholesaleCourier" ADD VALUE 'STEADFAST';

CREATE TABLE "wholesale_channels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price_list" "WholesalePriceList" NOT NULL DEFAULT 'RETAIL',
    "has_delivery" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wholesale_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wholesale_channels_name_key" ON "wholesale_channels"("name");

ALTER TABLE "wholesale_orders"
  ADD COLUMN "channel_id" INTEGER,
  ADD COLUMN "channel_data" JSONB,
  ADD COLUMN "channel_search" TEXT;
CREATE INDEX "wholesale_orders_channel_id_idx" ON "wholesale_orders"("channel_id");
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "wholesale_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cash Sale keeps today's behaviour: retail prices, no delivery leg, and the
-- GP number it always required -- now as the channel's own field.
INSERT INTO "wholesale_channels" ("name", "price_list", "has_delivery", "fields", "is_system", "sort_order", "updated_at")
VALUES (
  'Cash Sale', 'RETAIL', false,
  '[{"key":"gp_number","label":"GP Number","type":"text","required":true,"showInTable":true}]',
  true, 0, CURRENT_TIMESTAMP
);

-- Existing cash sales move onto it, carrying their GP number. The old
-- gp_number column is left in place (unused from here on) so nothing is lost.
UPDATE "wholesale_orders" o
SET "channel_id" = c."id",
    "channel_data" = CASE WHEN o."gp_number" IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('gp_number', o."gp_number") END,
    "channel_search" = o."gp_number"
FROM "wholesale_channels" c
WHERE c."name" = 'Cash Sale' AND o."type" = 'CHANNEL';
