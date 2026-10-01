-- Optional ceiling on a coupon's discount (e.g. 5% but at most 200).
ALTER TABLE "discounts" ADD COLUMN "max_discount_amount" DECIMAL(10,2);
