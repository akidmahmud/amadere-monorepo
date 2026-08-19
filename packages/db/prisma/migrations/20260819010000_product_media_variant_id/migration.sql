-- Optional per-variant product image (PDP swaps the gallery to the selected
-- variant's image; falls back to the product's primary image when unset).
--
-- Additive and nullable: every existing row keeps variant_id NULL and behaves
-- exactly as before. ON DELETE SET NULL so removing a variant detaches its
-- image rather than cascading the product's media row away.
ALTER TABLE "product_media" ADD COLUMN "variant_id" INTEGER;

CREATE INDEX "product_media_variant_id_idx" ON "product_media"("variant_id");

ALTER TABLE "product_media"
  ADD CONSTRAINT "product_media_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
