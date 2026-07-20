-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "link_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_translations" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "announcement_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "announcement_translations_announcement_id_locale_key" ON "announcement_translations"("announcement_id", "locale");

-- AddForeignKey
ALTER TABLE "announcement_translations" ADD CONSTRAINT "announcement_translations_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
