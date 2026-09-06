-- Where an abandoned cart came from.
--
-- The chain was broken in exactly one place. The browser captures utm_* and
-- referrer into a 30-day cookie (apps/web/src/lib/utm.ts), and `orders`
-- already has every one of these columns — but `incomplete_orders` had none,
-- so the moment a shopper abandoned, the attribution was gone. A cart
-- recovered by staff was then written with a hardcoded utmSource of
-- 'website', because there was genuinely nothing left to carry across.
--
-- Same names and types as the columns on `orders`, so the recovery path can
-- copy them straight over with no mapping.
ALTER TABLE "incomplete_orders"
  ADD COLUMN "utm_source"      TEXT,
  ADD COLUMN "utm_medium"      TEXT,
  ADD COLUMN "utm_campaign"    TEXT,
  ADD COLUMN "utm_term"        TEXT,
  ADD COLUMN "utm_content"     TEXT,
  ADD COLUMN "landing_domain"  TEXT,
  ADD COLUMN "landing_page"    TEXT,
  ADD COLUMN "referrer_url"    TEXT,
  ADD COLUMN "referrer_domain" TEXT;

-- "Show me the carts that came from Facebook ads" is the whole point of this,
-- and the funnel filters on it.
CREATE INDEX "incomplete_orders_utm_source_idx" ON "incomplete_orders"("utm_source");
