-- Storefront checkouts are Origin WEBSITE (owner, 2026-10-07). From 2026-09-03
-- checkout derived Origin from the referrer/utm, so Facebook-ad website orders
-- were stored as FACEBOOK, which the admin shows as "Messenger".
--
-- Only orders that are provably auto-derived are reset:
--   * placed by the customer: the first status-history row has no admin;
--   * Origin matches what the old derivation would give from its own Source
--     (the same patterns attribution.util.ts used), so an Origin a staff
--     member picked by hand is left alone.
-- Source (utm_source) is untouched, so the ad attribution stays visible.
UPDATE "orders" o
SET "channel" = 'WEBSITE'
WHERE o."order_number" NOT LIKE 'REC-%'
  AND o."utm_source" IS NOT NULL
  AND (
       (o."channel" = 'FACEBOOK'  AND o."utm_source" ~* '(facebook|fbads|fb[_-]?ads|^fb$|meta|(^|\.)fb\.(com|me)$)')
    OR (o."channel" = 'INSTAGRAM' AND o."utm_source" ~* '(instagram|^ig$|insta)')
    OR (o."channel" = 'TIKTOK'    AND o."utm_source" ~* 'tiktok')
    OR (o."channel" = 'YOUTUBE'   AND o."utm_source" ~* '(youtube|^yt$|youtu\.be)')
    OR (o."channel" = 'X'         AND o."utm_source" ~* '(twitter|^x$|(^|\.)x\.com$|^t\.co$)')
    OR (o."channel" = 'WHATSAPP'  AND o."utm_source" ~* 'whatsapp')
  )
  AND EXISTS (SELECT 1 FROM "order_status_history" h WHERE h."order_id" = o."id")
  AND (
    SELECT h."admin_user_id" FROM "order_status_history" h
    WHERE h."order_id" = o."id"
    ORDER BY h."created_at" ASC, h."id" ASC
    LIMIT 1
  ) IS NULL;
