-- Abandoned carts get a restorable trash, replacing the old "cancel" action.
--
-- Deleting a cart used to hard-delete the row, so a misclick was unrecoverable
-- and the reason staff typed went with it. Now it soft-deletes: the cart
-- leaves every working list and every funnel figure at once, and stays
-- restorable for 30 days before the nightly purge removes it (same contract
-- and retention as BlogPost and Product trash).
--
-- `canceled_at` is left alone. It keeps its meaning for the rows that already
-- carry it, and the Cancelled filter still finds them; the admin simply no
-- longer creates new ones.
ALTER TABLE "incomplete_orders" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "incomplete_orders_deleted_at_idx" ON "incomplete_orders"("deleted_at");
