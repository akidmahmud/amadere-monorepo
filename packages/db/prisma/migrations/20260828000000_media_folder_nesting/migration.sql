-- Nested media folders. Hand-written + `migrate deploy`: `prisma migrate dev`
-- cannot run in this repo (the pre-existing FK violation in
-- 20260807103916_promo_videos_standalone fails the shadow database).
ALTER TABLE "media_folders" ADD COLUMN "parent_id" INTEGER;

CREATE INDEX "media_folders_parent_id_idx" ON "media_folders" ("parent_id");

-- Cascade: deleting a folder removes its subfolders too. Media is untouched —
-- media.folder_id is ON DELETE SET NULL, so files fall back to "unfiled".
ALTER TABLE "media_folders"
  ADD CONSTRAINT "media_folders_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
