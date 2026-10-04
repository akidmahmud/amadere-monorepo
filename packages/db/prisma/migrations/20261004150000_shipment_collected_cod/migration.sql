-- What the courier reports it collected (partial delivery: only the delivery charge).
ALTER TABLE "shipments" ADD COLUMN "collected_cod_amount" DECIMAL(10,2);
