-- CreateTable
CREATE TABLE "marketing_review_cards" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_review_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_review_card_translations" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "caption" TEXT,

    CONSTRAINT "marketing_review_card_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_review_card_translations_card_id_locale_key" ON "marketing_review_card_translations"("card_id", "locale");

-- AddForeignKey
ALTER TABLE "marketing_review_card_translations" ADD CONSTRAINT "marketing_review_card_translations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "marketing_review_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
