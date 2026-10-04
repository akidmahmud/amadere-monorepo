-- Stock in: expiry date of the units received (POS expiry report / alerts).
ALTER TABLE "stock_movements" ADD COLUMN "expiry_date" DATE;
