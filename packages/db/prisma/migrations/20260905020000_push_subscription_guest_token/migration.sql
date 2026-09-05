-- Abandoned-cart push was unreachable without this. Every abandoned cart on
-- this shop has customer_id NULL — shoppers fill a cart long before they sign
-- in — so keying push on the customer meant the channel could essentially
-- never fire. Cart.guest_token is the handle that connects "this browser
-- agreed to notifications" to "this cart was left behind".
ALTER TABLE "push_subscriptions" ADD COLUMN "guest_token" TEXT;
CREATE INDEX "push_subscriptions_guest_token_revoked_at_idx"
  ON "push_subscriptions"("guest_token", "revoked_at");
