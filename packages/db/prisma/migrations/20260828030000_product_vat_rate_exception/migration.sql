-- Per-product VAT rate override for the Accounts > VAT Exception tab.
-- NULL = use the store rate (accounts_vat.ratePercent); 0 = explicitly
-- zero-rated. Those are deliberately different states, which is why this is
-- nullable rather than defaulting to 0.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).
ALTER TABLE "products" ADD COLUMN "vat_rate_percent" DECIMAL(5,2);
