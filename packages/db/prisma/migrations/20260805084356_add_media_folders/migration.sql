-- AlterTable
ALTER TABLE "media" ADD COLUMN     "folder_id" INTEGER;

-- CreateTable
CREATE TABLE "media_folders" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_folder_id_idx" ON "media"("folder_id");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
