-- CreateEnum
CREATE TYPE "NewsletterSegmentType" AS ENUM ('ALL', 'TAG', 'NEW_SUBSCRIBERS');

-- AlterEnum
ALTER TYPE "NewsletterCampaignStatus" ADD VALUE 'SCHEDULED';

-- AlterTable: dropping this DB-level default on purpose — application code
-- now always supplies trackingToken explicitly (randomUUID() in
-- NewsletterCampaignsService), since Prisma's createMany() doesn't reliably
-- run client-side generator defaults and this column was silently depending
-- on a DB default that only existed because the P0 migration hand-added it.
ALTER TABLE "newsletter_campaign_recipients" ALTER COLUMN "tracking_token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "newsletter_campaigns" ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "segment_id" INTEGER;

-- CreateTable
CREATE TABLE "newsletter_segments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NewsletterSegmentType" NOT NULL,
    "tag_id" INTEGER,
    "days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriber_tags" (
    "subscriber_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "newsletter_subscriber_tags_pkey" PRIMARY KEY ("subscriber_id","tag_id")
);

-- CreateTable
CREATE TABLE "newsletter_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content_json" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_tags_name_key" ON "newsletter_tags"("name");

-- AddForeignKey
ALTER TABLE "newsletter_segments" ADD CONSTRAINT "newsletter_segments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "newsletter_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriber_tags" ADD CONSTRAINT "newsletter_subscriber_tags_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriber_tags" ADD CONSTRAINT "newsletter_subscriber_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "newsletter_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "newsletter_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
