-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "DelayUnit" AS ENUM ('MINUTE', 'HOUR', 'DAY');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "cart_campaign_templates" (
    "id" SERIAL NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body_en" TEXT NOT NULL,
    "body_bn" TEXT NOT NULL,
    "delay_value" INTEGER NOT NULL DEFAULT 30,
    "delay_unit" "DelayUnit" NOT NULL DEFAULT 'MINUTE',
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_campaign_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_campaign_queue" (
    "id" SERIAL NOT NULL,
    "incomplete_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "recipient" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "locked_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_campaign_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_campaign_logs" (
    "id" SERIAL NOT NULL,
    "incomplete_id" INTEGER NOT NULL,
    "template_id" INTEGER,
    "channel" "CampaignChannel" NOT NULL,
    "recipient" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response_code" TEXT,
    "response_msg" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_campaign_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cart_campaign_queue_status_scheduled_at_idx" ON "cart_campaign_queue"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "cart_campaign_queue_incomplete_id_template_id_channel_key" ON "cart_campaign_queue"("incomplete_id", "template_id", "channel");

-- CreateIndex
CREATE INDEX "cart_campaign_logs_incomplete_id_idx" ON "cart_campaign_logs"("incomplete_id");

-- AddForeignKey
ALTER TABLE "cart_campaign_queue" ADD CONSTRAINT "cart_campaign_queue_incomplete_id_fkey" FOREIGN KEY ("incomplete_id") REFERENCES "incomplete_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_campaign_queue" ADD CONSTRAINT "cart_campaign_queue_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "cart_campaign_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
