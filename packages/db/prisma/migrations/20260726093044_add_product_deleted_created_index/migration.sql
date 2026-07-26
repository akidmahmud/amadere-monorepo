-- CreateIndex
CREATE INDEX "products_deleted_at_created_at_idx" ON "products"("deleted_at", "created_at");
