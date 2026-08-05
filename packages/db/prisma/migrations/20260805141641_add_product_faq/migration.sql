-- CreateTable
CREATE TABLE "product_faqs" (
    "id" SERIAL NOT NULL,
    "translation_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_faqs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_faqs" ADD CONSTRAINT "product_faqs_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "product_translations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
