-- Accounts module redesign: the posting ledger, party master, cash accounts,
-- VAT/withholding fields on expenses, and COD settlements.
-- Design: docs/superpowers/specs/2026-08-23-accounts-module-redesign-design.md
--
-- The DROP COLUMN statements on "expenses" and "dues" are safe: both tables
-- held 0 rows when this was written (verified 2026-08-23; the database itself
-- is populated -- 3,366 orders, 2,725 shipments -- those two tables were
-- simply never used). That is also why the new columns can be NOT NULL
-- immediately rather than going through a nullable-then-backfill-then-tighten
-- sequence.
--
-- dues.paid_amount and dues.status are dropped rather than kept because they
-- are now derived from ledger_entries. A stored cumulative paid_amount beside
-- the movements is what made cash-flow reporting count a three-instalment due
-- three times.

-- CreateEnum
CREATE TYPE "DueKind" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "DueSource" AS ENUM ('MANUAL', 'EXPENSE', 'ORDER', 'COD_IN_TRANSIT', 'OPENING', 'WHOLESALE_INVOICE');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('SUPPLIER', 'CUSTOMER', 'COURIER', 'STAFF', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK', 'MOBILE_WALLET');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('SALE', 'COD_REMITTANCE', 'EXPENSE_PAYMENT', 'RECEIVABLE_RECEIPT', 'PAYABLE_PAYMENT', 'TRANSFER', 'OPENING', 'ADJUSTMENT', 'REFUND');

-- DropForeignKey
ALTER TABLE "dues" DROP CONSTRAINT "dues_customer_id_fkey";

-- DropIndex
DROP INDEX "dues_party_type_idx";

-- DropIndex
DROP INDEX "dues_status_idx";

-- AlterTable
ALTER TABLE "dues" DROP COLUMN "customer_id",
DROP COLUMN "paid_amount",
DROP COLUMN "party_name",
DROP COLUMN "party_type",
DROP COLUMN "status",
ADD COLUMN     "doc_no" TEXT NOT NULL,
ADD COLUMN     "expense_id" INTEGER,
ADD COLUMN     "issue_date" DATE NOT NULL,
ADD COLUMN     "kind" "DueKind" NOT NULL,
ADD COLUMN     "order_id" INTEGER,
ADD COLUMN     "party_id" INTEGER NOT NULL,
ADD COLUMN     "source" "DueSource" NOT NULL,
ADD COLUMN     "voided_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "amount",
DROP COLUMN "category",
DROP COLUMN "is_vat_input",
ADD COLUMN     "ait_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ait_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amount_includes_vat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "category_id" INTEGER NOT NULL,
ADD COLUMN     "cost_centre_id" INTEGER,
ADD COLUMN     "due_date" DATE,
ADD COLUMN     "gross_amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "mushak_challan_no" TEXT,
ADD COLUMN     "net_amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "net_payable" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "party_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vds_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vds_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voucher_no" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "cod_settlement_id" INTEGER;

-- DropEnum
DROP TYPE "DuePartyType";

-- DropEnum
DROP TYPE "DueStatus";

-- CreateTable
CREATE TABLE "parties" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL DEFAULT 'COMPANY',
    "roles" "PartyRole"[],
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bin" TEXT,
    "tin" TEXT,
    "customer_id" INTEGER,
    "opening_receivable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opening_payable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(12,2),
    "credit_days" INTEGER,
    "courier_provider" "CourierProviderName",
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "account_number" TEXT,
    "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opening_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" SERIAL NOT NULL,
    "entry_date" DATE NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "party_id" INTEGER,
    "source" "LedgerSource" NOT NULL,
    "expense_id" INTEGER,
    "due_id" INTEGER,
    "order_id" INTEGER,
    "reference" TEXT,
    "note" TEXT,
    "reversal_of_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_vat_claimable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centres" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_locks" (
    "id" SERIAL NOT NULL,
    "month" DATE NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" INTEGER,
    "note" TEXT,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cod_settlements" (
    "id" SERIAL NOT NULL,
    "provider" "CourierProviderName" NOT NULL,
    "party_id" INTEGER NOT NULL,
    "settlement_date" DATE NOT NULL,
    "cod_collected" DECIMAL(12,2) NOT NULL,
    "courier_charges" DECIMAL(12,2) NOT NULL,
    "net_payout" DECIMAL(12,2) NOT NULL,
    "adjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "account_id" INTEGER NOT NULL,
    "expense_id" INTEGER,
    "reference" TEXT,
    "note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cod_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parties_courier_provider_key" ON "parties"("courier_provider");

-- CreateIndex
CREATE INDEX "parties_name_idx" ON "parties"("name");

-- CreateIndex
CREATE INDEX "ledger_entries_entry_date_idx" ON "ledger_entries"("entry_date");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_entry_date_idx" ON "ledger_entries"("account_id", "entry_date");

-- CreateIndex
CREATE INDEX "ledger_entries_party_id_idx" ON "ledger_entries"("party_id");

-- CreateIndex
CREATE INDEX "ledger_entries_due_id_idx" ON "ledger_entries"("due_id");

-- CreateIndex
CREATE INDEX "ledger_entries_expense_id_idx" ON "ledger_entries"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centres_name_key" ON "cost_centres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "period_locks_month_key" ON "period_locks"("month");

-- CreateIndex
CREATE INDEX "cod_settlements_provider_settlement_date_idx" ON "cod_settlements"("provider", "settlement_date");

-- CreateIndex
CREATE UNIQUE INDEX "dues_doc_no_key" ON "dues"("doc_no");

-- CreateIndex
CREATE INDEX "dues_kind_idx" ON "dues"("kind");

-- CreateIndex
CREATE INDEX "dues_party_id_idx" ON "dues"("party_id");

-- CreateIndex
CREATE INDEX "dues_order_id_idx" ON "dues"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_voucher_no_key" ON "expenses"("voucher_no");

-- CreateIndex
CREATE INDEX "expenses_party_id_idx" ON "expenses"("party_id");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cod_settlement_id_fkey" FOREIGN KEY ("cod_settlement_id") REFERENCES "cod_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "cost_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues" ADD CONSTRAINT "dues_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues" ADD CONSTRAINT "dues_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues" ADD CONSTRAINT "dues_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_due_id_fkey" FOREIGN KEY ("due_id") REFERENCES "dues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

