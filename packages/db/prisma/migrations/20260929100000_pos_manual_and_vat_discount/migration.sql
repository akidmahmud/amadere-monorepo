-- POS: manual discount and "VAT coupon" amounts per sale (both part of discount_amount).
ALTER TABLE "orders" ADD COLUMN "pos_manual_discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "pos_vat_discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
