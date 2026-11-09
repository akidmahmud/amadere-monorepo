-- Visitor IP on an abandoned cart, so staff can block scammers from Recovery.
ALTER TABLE "incomplete_orders" ADD COLUMN "ip_address" TEXT;
