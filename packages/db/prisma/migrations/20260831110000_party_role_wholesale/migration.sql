-- Split into its own migration on purpose: `ALTER TYPE ... ADD VALUE` and any
-- use of the new value cannot share a transaction, and Prisma runs one
-- migration per transaction. Keeping the enum change alone means the wholesale
-- tables that follow can reference it freely.

-- Wholesale buyers are `parties`, marked by this role. A role rather than a
-- separate table because a wholesale buyer is a counterparty like any other,
-- and a real one can be both (a shop that also supplies us) -- which two
-- tables could not express.
ALTER TYPE "PartyRole" ADD VALUE 'WHOLESALE';
