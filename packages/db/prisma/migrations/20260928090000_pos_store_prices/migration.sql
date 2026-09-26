-- POS: a store's own price for a catalogue product/variant.
CREATE TABLE "store_prices" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "variant_id" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2),
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "store_prices_store_id_idx" ON "store_prices"("store_id");

-- One price per store + SKU; a plain unique would treat NULL variant ids as distinct.
CREATE UNIQUE INDEX "store_prices_store_product_variant_key"
  ON "store_prices" ("store_id", "product_id", (COALESCE("variant_id", 0)));

ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_sale_below_price" CHECK ("sale_price" IS NULL OR "sale_price" <= "price");
