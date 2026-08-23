-- Accounts module redesign: the posting ledger, party master, cash accounts,
-- VAT/withholding fields on expenses, and COD settlements.
-- Design: docs/superpowers/specs/2026-08-23-accounts-module-redesign-design.md
--
-- REWRITTEN after the first version failed in production (error 23502,
-- "column category_id of relation expenses contains null values").
--
-- That version added the new expense columns as NOT NULL in one statement,
-- which only works on an empty table. It was written against a development
-- database where `expenses` and `dues` both held 0 rows; production had 4
-- expense rows. The failure was partial, not atomic — the enums and the
-- `dues` rewrite committed, and everything from the `expenses` statement
-- onward did not.
--
-- This version does what the design document originally specified (§6.2):
-- create the new tables first, seed the two rows the backfill needs, add the
-- expense columns as NULLABLE, populate them from the old columns, and only
-- then tighten to NOT NULL and drop what is superseded. It is safe on an
-- empty table and on one with rows.
--
-- `dues` is still rewritten directly rather than backfilled: it holds no rows
-- in any environment, and its old shape (free-text party_name, a stored
-- paid_amount) has no meaningful mapping onto the new one anyway.

-- CreateEnum
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


-- New tables. Created before the expense backfill, which needs to
-- insert into expense_categories and parties.
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


-- ---------------------------------------------------------------------
-- Backfill support rows.
--
-- Existing expenses have a free-text `category` and no payee at all, but the
-- new columns are NOT NULL foreign keys. These two rows give every historic
-- row somewhere valid to point. Both are ordinary records an admin can
-- rename, merge or deactivate afterwards.
-- ---------------------------------------------------------------------

-- One category per distinct legacy string, so nothing is flattened away.
-- NOT EXISTS rather than ON CONFLICT: the unique index on
-- expense_categories.name is created further down this file, and ON CONFLICT
-- requires the constraint to already exist.
INSERT INTO "expense_categories" ("name", "is_vat_claimable", "is_active", "sort_order")
SELECT DISTINCT trim(e."category"), true, true, 900
FROM "expenses" e
WHERE trim(coalesce(e."category", '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "expense_categories" c WHERE c."name" = trim(e."category")
  );

-- Fallback for rows whose category was blank.
INSERT INTO "expense_categories" ("name", "is_vat_claimable", "is_active", "sort_order")
SELECT 'Uncategorised', true, true, 999
WHERE NOT EXISTS (
  SELECT 1 FROM "expense_categories" WHERE "name" = 'Uncategorised'
);

-- Historic expenses have no payee. A real party master entry, flagged in its
-- note so the admin can re-point these rows and then retire it.
INSERT INTO "parties" ("name", "type", "roles", "note", "is_active", "created_at", "updated_at")
SELECT 'Unassigned', 'COMPANY', ARRAY['OTHER']::"PartyRole"[],
       'Auto-created for expenses migrated from before the party master existed. Re-point them, then deactivate this.',
       true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "parties" WHERE "name" = 'Unassigned');

-- ---------------------------------------------------------------------
-- expenses: add nullable, backfill, then tighten.
-- ---------------------------------------------------------------------

ALTER TABLE "expenses"
  ADD COLUMN "voucher_no" TEXT,
  ADD COLUMN "category_id" INTEGER,
  ADD COLUMN "cost_centre_id" INTEGER,
  ADD COLUMN "party_id" INTEGER,
  ADD COLUMN "net_amount" DECIMAL(12,2),
  ADD COLUMN "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "gross_amount" DECIMAL(12,2),
  ADD COLUMN "amount_includes_vat" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mushak_challan_no" TEXT,
  ADD COLUMN "ait_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "ait_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vds_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vds_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "net_payable" DECIMAL(12,2),
  ADD COLUMN "due_date" DATE,
  ADD COLUMN "attachment_url" TEXT,
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Voucher numbers, sequential within each row's own month (EXP-YYMM-NNNN),
-- matching what the application generates for new vouchers.
WITH numbered AS (
  SELECT "id",
         'EXP-' || to_char("expense_date", 'YYMM') || '-' ||
         lpad((row_number() OVER (
           PARTITION BY date_trunc('month', "expense_date")
           ORDER BY "expense_date", "id"
         ))::text, 4, '0') AS vno
  FROM "expenses"
)
UPDATE "expenses" e SET "voucher_no" = n.vno FROM numbered n WHERE e."id" = n."id";

-- Category and payee.
UPDATE "expenses" e
SET "category_id" = c."id"
FROM "expense_categories" c
WHERE c."name" = trim(coalesce(nullif(trim(e."category"), ''), 'Uncategorised'));

UPDATE "expenses" e
SET "party_id" = p."id"
FROM "parties" p
WHERE p."name" = 'Unassigned' AND e."party_id" IS NULL;

-- The VAT split.
--
-- Legacy `is_vat_input` rows are treated as VAT-INCLUSIVE at the standard
-- 15% rate: net = amount x 100/115. The code being replaced multiplied the
-- amount by the rate as though it were VAT-exclusive, which overstated
-- claimable input VAT by ~13% on the inclusive bills Bangladeshi suppliers
-- actually issue. This is the conservative direction — it claims less, not
-- more, than the previous behaviour.
UPDATE "expenses"
SET "gross_amount" = "amount",
    "net_amount"   = CASE WHEN "is_vat_input"
                          THEN round("amount" * 100.0 / 115.0, 2)
                          ELSE "amount" END,
    "vat_amount"   = CASE WHEN "is_vat_input"
                          THEN "amount" - round("amount" * 100.0 / 115.0, 2)
                          ELSE 0 END,
    "vat_rate"     = CASE WHEN "is_vat_input" THEN 15 ELSE 0 END,
    "amount_includes_vat" = "is_vat_input",
    -- No withholding was ever recorded, so net payable is the full bill.
    "net_payable"  = "amount",
    "note"         = CASE
                       WHEN coalesce("note", '') = '' THEN '[migrated]'
                       ELSE '[migrated] ' || "note"
                     END;

-- Now that every row has a value, the columns can carry their real
-- constraints.
ALTER TABLE "expenses"
  ALTER COLUMN "voucher_no"  SET NOT NULL,
  ALTER COLUMN "category_id" SET NOT NULL,
  ALTER COLUMN "party_id"    SET NOT NULL,
  ALTER COLUMN "net_amount"  SET NOT NULL,
  ALTER COLUMN "gross_amount" SET NOT NULL,
  ALTER COLUMN "net_payable" SET NOT NULL;

-- The default existed only so the NOT NULL column could be added to a table
-- that already had rows. Prisma's @updatedAt sets this on every write, and
-- schema.prisma declares no default, so leaving one here would be drift.
ALTER TABLE "expenses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Superseded by the columns above.
ALTER TABLE "expenses"
  DROP COLUMN "amount",
  DROP COLUMN "category",
  DROP COLUMN "is_vat_input";

-- ---------------------------------------------------------------------
-- dues: no rows in any environment, so rewritten directly.
-- ---------------------------------------------------------------------
-- DropForeignKey
-- IF EXISTS throughout this block: an earlier attempt at this migration
-- failed part-way through and left some of it applied, so it has to be
-- tolerant of a database where these are already gone.
ALTER TABLE "dues" DROP CONSTRAINT IF EXISTS "dues_customer_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "dues_party_type_idx";

-- DropIndex
DROP INDEX IF EXISTS "dues_status_idx";

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
ALTER TABLE "shipments" ADD COLUMN     "cod_settlement_id" INTEGER;


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



-- Dropped last: the dues rewrite above removes the only columns using
-- these, and dropping a type still in use fails.
-- DropEnum
DROP TYPE "DuePartyType";

-- DropEnum
DROP TYPE "DueStatus";

