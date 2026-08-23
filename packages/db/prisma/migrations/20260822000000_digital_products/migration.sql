-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "product_type_snapshot" "ProductType" NOT NULL DEFAULT 'PHYSICAL';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "digital_file_key" TEXT,
ADD COLUMN     "digital_file_name" TEXT,
ADD COLUMN     "digital_file_size" INTEGER,
ADD COLUMN     "digital_page_count" INTEGER,
ADD COLUMN     "digital_preview_pages" INTEGER;

-- CreateTable
CREATE TABLE "product_preview_pages" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "page_number" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,

    CONSTRAINT "product_preview_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_downloads" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "token" TEXT NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_download_at" TIMESTAMP(3),
    "unlocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_preview_pages_product_id_page_number_key" ON "product_preview_pages"("product_id", "page_number");

-- CreateIndex
CREATE UNIQUE INDEX "digital_downloads_token_key" ON "digital_downloads"("token");

-- CreateIndex
CREATE INDEX "digital_downloads_customer_id_idx" ON "digital_downloads"("customer_id");

-- AddForeignKey
ALTER TABLE "product_preview_pages" ADD CONSTRAINT "product_preview_pages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_downloads" ADD CONSTRAINT "digital_downloads_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_downloads" ADD CONSTRAINT "digital_downloads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_downloads" ADD CONSTRAINT "digital_downloads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
