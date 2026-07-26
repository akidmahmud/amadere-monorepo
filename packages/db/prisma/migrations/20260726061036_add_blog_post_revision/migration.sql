-- CreateTable
CREATE TABLE "blog_post_revisions" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "admin_user_id" INTEGER,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_post_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_post_revisions_post_id_idx" ON "blog_post_revisions"("post_id");

-- AddForeignKey
ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
