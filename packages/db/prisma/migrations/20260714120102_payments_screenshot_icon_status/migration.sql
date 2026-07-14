-- AlterTable
ALTER TABLE "manual_payments" ADD COLUMN     "screenshot_url" TEXT;

-- AlterTable
ALTER TABLE "payment_method_configs" ADD COLUMN     "icon_url" TEXT,
ADD COLUMN     "order_status_after_verify" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "show_icon" BOOLEAN NOT NULL DEFAULT true;
