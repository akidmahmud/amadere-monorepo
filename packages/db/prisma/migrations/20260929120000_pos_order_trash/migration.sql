-- POS order trash: delete undoes a completed sale; restore re-applies it.
ALTER TABLE "orders" ADD COLUMN "pos_voided_by_delete" BOOLEAN NOT NULL DEFAULT false;
