-- CreateTable
CREATE TABLE "marketing_costs" (
    "id" SERIAL NOT NULL,
    "cost_date" DATE NOT NULL,
    "ads_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "auto_carried" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_profit_cache" (
    "id" SERIAL NOT NULL,
    "report_date" DATE NOT NULL,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_buy_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_ads_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_other" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_shipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_profit_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_costs_cost_date_key" ON "marketing_costs"("cost_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_profit_cache_report_date_key" ON "daily_profit_cache"("report_date");

-- CreateIndex
CREATE INDEX "daily_profit_cache_report_date_idx" ON "daily_profit_cache"("report_date");
