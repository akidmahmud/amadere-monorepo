-- Wholesale gains cash sales, a delivery snapshot, and payment detail.
--
-- Everything is additive with a default or nullable, so the 'wholesale_orders'
-- rows that already exist stay valid: they become type = WHOLESALE (which is
-- what they were), paymentStatus = UNPAID until the ledger is consulted, and
-- keep their courier.

CREATE TYPE "WholesaleOrderType" AS ENUM ('WHOLESALE', 'CASH_SALE');
CREATE TYPE "WholesaleOrderChannel" AS ENUM ('WHATSAPP', 'FACEBOOK', 'MESSENGER', 'PHONE', 'IN_STORE_POS', 'OTHER');
CREATE TYPE "WholesalePaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'BANK');
CREATE TYPE "WholesalePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

ALTER TABLE "wholesale_orders"
  ADD COLUMN "type"            "WholesaleOrderType"     NOT NULL DEFAULT 'WHOLESALE',
  ADD COLUMN "channel"         "WholesaleOrderChannel",
  ADD COLUMN "payment_method"  "WholesalePaymentMethod",
  ADD COLUMN "payment_status"  "WholesalePaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "transaction_id"  TEXT,
  ADD COLUMN "gp_number"       TEXT,
  ADD COLUMN "recipient_name"    TEXT,
  ADD COLUMN "recipient_phone"   TEXT,
  ADD COLUMN "alternative_phone" TEXT,
  ADD COLUMN "recipient_email"   TEXT,
  ADD COLUMN "address_line"      TEXT,
  ADD COLUMN "district"          TEXT,
  ADD COLUMN "thana"             TEXT,
  ADD COLUMN "landmark"          TEXT,
  ADD COLUMN "post_code"         TEXT;

-- A cash sale never touches a courier, so this can no longer be required.
ALTER TABLE "wholesale_orders" ALTER COLUMN "courier" DROP NOT NULL;

-- Taka off one line, before the order-level discount.
ALTER TABLE "wholesale_order_items"
  ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- The dashboards filter and group on these.
CREATE INDEX "wholesale_orders_type_idx" ON "wholesale_orders"("type");
CREATE INDEX "wholesale_orders_payment_status_idx" ON "wholesale_orders"("payment_status");
