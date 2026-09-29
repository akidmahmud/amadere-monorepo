-- A store's own photo for a shared product (POS pencil popup).
ALTER TABLE "store_prices" ADD COLUMN "media_id" INTEGER;
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
