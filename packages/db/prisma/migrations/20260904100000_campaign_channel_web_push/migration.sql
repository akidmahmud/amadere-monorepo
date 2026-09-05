-- Its own migration on purpose: Postgres refuses to use a new enum value in the
-- same transaction that adds it, so the value must land before anything
-- references it.
ALTER TYPE "CampaignChannel" ADD VALUE IF NOT EXISTS 'WEB_PUSH';
