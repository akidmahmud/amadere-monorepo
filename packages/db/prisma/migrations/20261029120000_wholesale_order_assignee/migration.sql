-- Who an order belongs to; existing orders go to whoever created them.
ALTER TABLE "wholesale_orders" ADD COLUMN "assigned_admin_id" INTEGER;

-- created_by had no FK; drop ids of staff that no longer exist so it can get one.
UPDATE "wholesale_orders" SET "created_by" = NULL
WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT "id" FROM "admin_users");

UPDATE "wholesale_orders" SET "assigned_admin_id" = "created_by";

CREATE INDEX "wholesale_orders_assigned_admin_id_idx" ON "wholesale_orders"("assigned_admin_id");

ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
