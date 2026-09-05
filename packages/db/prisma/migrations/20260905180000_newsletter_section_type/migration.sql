-- The newsletter banner was hardcoded at the foot of the homepage with no
-- image and no admin control. Making it a real section so it is managed like
-- every other block (sort order, active toggle, MediaPicker image).
--
-- ALONE in its own migration on purpose: Postgres will not let a new enum
-- value be USED in the same transaction that adds it, so any migration that
-- both adds this and writes a row with it fails at deploy.
ALTER TYPE "HomepageSectionType" ADD VALUE IF NOT EXISTS 'NEWSLETTER';
