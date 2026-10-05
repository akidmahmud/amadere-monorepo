-- Exact time span of each sales report, so it can show full date and time.
ALTER TABLE "daily_reports" ADD COLUMN "window_start" TIMESTAMP(3);
ALTER TABLE "daily_reports" ADD COLUMN "window_end" TIMESTAMP(3);

-- Existing reports used business days: (from - 1) 20:00 Dhaka -> to 20:00 Dhaka,
-- i.e. from 00:00 UTC - 10 h -> to 00:00 UTC + 14 h.
UPDATE "daily_reports"
SET "window_start" = "period_from"::timestamp - interval '10 hours',
    "window_end"   = "period_to"::timestamp + interval '14 hours';
