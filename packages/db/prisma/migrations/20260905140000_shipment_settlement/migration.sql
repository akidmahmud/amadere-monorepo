-- What the courier ACTUALLY collected for a parcel, from their settlement
-- API — as opposed to `cod_amount`, which is only what we asked them to
-- collect. The two are known to disagree: a live payout had one order where
-- we asked for 2450 and Steadfast collected 2350.
--
-- Deliberately separate from `cod_settlement_id`. That links a shipment to a
-- CodSettlement, which is an ACCOUNTING record (party, cash account, expense
-- posting) created deliberately by staff. These columns are just the
-- courier's reported facts, synced read-only, and posting them to the ledger
-- stays a separate, human-initiated step.
ALTER TABLE "shipments"
  ADD COLUMN "settled_cod_amount"   DECIMAL(10,2),
  -- The courier's own payout id (Steadfast: "SFC-31770483").
  ADD COLUMN "settlement_reference" TEXT,
  -- The courier's per-parcel status as of that payout ("delivered",
  -- "partial_delivered"), which is authoritative over our own tracked status
  -- — a live payout showed a parcel Steadfast had delivered and paid out
  -- while we still had the order PENDING.
  ADD COLUMN "settlement_status"    TEXT,
  ADD COLUMN "settled_at"           TIMESTAMP(3);

-- The sync matches payouts back to parcels by consignment id, so that lookup
-- has to be indexed. Not unique: a cancelled-and-recreated consignment can
-- legitimately reuse nothing, but historical rows may still collide, and a
-- unique constraint here would make the sync fail rather than degrade.
CREATE INDEX "shipments_consignment_id_idx" ON "shipments"("consignment_id");
