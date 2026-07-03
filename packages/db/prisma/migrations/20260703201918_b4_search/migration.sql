-- CreateTable
CREATE TABLE "synonym_groups" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synonym_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synonym_terms" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,

    CONSTRAINT "synonym_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "synonym_terms_group_id_idx" ON "synonym_terms"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "synonym_terms_term_locale_key" ON "synonym_terms"("term", "locale");

-- Enable trigram similarity/typo-tolerant matching for search (B4)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "product_translations_name_idx" ON "product_translations" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "synonym_terms" ADD CONSTRAINT "synonym_terms_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "synonym_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
