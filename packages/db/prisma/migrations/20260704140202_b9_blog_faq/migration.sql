-- CreateTable
CREATE TABLE "blog_post_faqs" (
    "id" SERIAL NOT NULL,
    "translation_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_post_faqs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "blog_post_faqs" ADD CONSTRAINT "blog_post_faqs_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "blog_post_translations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
