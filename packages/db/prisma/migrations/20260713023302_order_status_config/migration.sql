-- CreateTable
CREATE TABLE "order_status_configs" (
    "id" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_bn" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_status_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_status_configs_status_key" ON "order_status_configs"("status");
