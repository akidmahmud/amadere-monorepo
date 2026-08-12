-- CreateEnum
CREATE TYPE "EmailTemplateGroup" AS ENUM ('BASE', 'ACL', 'CONTACT', 'ECOMMERCE', 'NEWSLETTER');

-- CreateTable
CREATE TABLE "email_templates" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "group" "EmailTemplateGroup" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL,
    "default_subject" TEXT NOT NULL DEFAULT '',
    "default_body_html" TEXT NOT NULL DEFAULT '',
    "variables" JSONB NOT NULL DEFAULT '[]',
    "can_disable" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");
