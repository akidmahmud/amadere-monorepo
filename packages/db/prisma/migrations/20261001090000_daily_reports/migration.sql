-- Daily Report (spec 2026-10-01).
CREATE TYPE "DailyReportKind" AS ENUM ('AUTO', 'MANUAL');

CREATE TABLE "daily_reports" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DailyReportKind" NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "total_sales" DECIMAL(12,2) NOT NULL,
    "net_profit" DECIMAL(12,2) NOT NULL,
    "created_by_id" INTEGER,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daily_reports_period_from_idx" ON "daily_reports"("period_from");
CREATE INDEX "daily_reports_created_at_idx" ON "daily_reports"("created_at");

-- One nightly report per day, even if two API instances fire the cron.
CREATE UNIQUE INDEX "daily_reports_auto_day" ON "daily_reports"("period_from") WHERE "kind" = 'AUTO';

INSERT INTO "permissions" ("resource", "action", "key") VALUES
  ('net_profit_daily_report', 'view', 'net_profit_daily_report.view'),
  ('net_profit_daily_report', 'manage', 'net_profit_daily_report.manage')
ON CONFLICT ("key") DO NOTHING;
