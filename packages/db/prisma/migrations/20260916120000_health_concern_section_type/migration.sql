-- "Shop By Health Concern" becomes a managed homepage section.
--
-- ALONE in its own migration on purpose (same reason as the NEWSLETTER one):
-- Postgres will not let a new enum value be used in the transaction that adds
-- it, so the row that uses it is written by the next migration.
ALTER TYPE "HomepageSectionType" ADD VALUE IF NOT EXISTS 'HEALTH_CONCERN';
