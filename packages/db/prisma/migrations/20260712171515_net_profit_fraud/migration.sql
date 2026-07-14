-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

-- CreateTable
CREATE TABLE "fraud_checks" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "breakdown" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_savings" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER,
    "phone" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_savings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fraud_checks_phone_key" ON "fraud_checks"("phone");

-- CreateIndex
CREATE INDEX "fraud_checks_risk_level_idx" ON "fraud_checks"("risk_level");

-- CreateIndex
CREATE INDEX "fraud_savings_created_at_idx" ON "fraud_savings"("created_at");

-- AddForeignKey
ALTER TABLE "fraud_savings" ADD CONSTRAINT "fraud_savings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
