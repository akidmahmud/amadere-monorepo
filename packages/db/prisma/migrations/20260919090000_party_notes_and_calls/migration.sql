-- Wholesale-buyer notes and call logs (twins of customer_notes / customer_call_logs).

-- CreateTable
CREATE TABLE "party_notes" (
    "id" SERIAL NOT NULL,
    "party_id" INTEGER NOT NULL,
    "type" "CustomerNoteType" NOT NULL,
    "body" TEXT NOT NULL,
    "author_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_call_logs" (
    "id" SERIAL NOT NULL,
    "party_id" INTEGER NOT NULL,
    "phone_called" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "author_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "party_notes_party_id_idx" ON "party_notes"("party_id");

-- CreateIndex
CREATE INDEX "party_call_logs_party_id_idx" ON "party_call_logs"("party_id");

-- AddForeignKey
ALTER TABLE "party_notes" ADD CONSTRAINT "party_notes_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_notes" ADD CONSTRAINT "party_notes_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_call_logs" ADD CONSTRAINT "party_call_logs_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_call_logs" ADD CONSTRAINT "party_call_logs_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
