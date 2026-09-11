-- First-party traffic. One row per page view, sent by a beacon on the
-- storefront rather than read back out of Google Analytics -- the pixels in
-- Settings > Analytics report to Google, not to us, so until now the admin
-- had no traffic figure of its own to show.
--
-- Deliberately NOT stored: IP address, user agent string, or anything else
-- that identifies a person. `visitorId` and `sessionId` are random ids the
-- browser generates for itself; they distinguish visitors without naming one.
CREATE TABLE "page_views" (
  "id"              BIGSERIAL PRIMARY KEY,
  -- Random, browser-generated. localStorage (persists) vs sessionStorage
  -- (per visit) -- that is the whole difference between "visitors" and
  -- "sessions", and it costs one extra column.
  "visitor_id"      TEXT NOT NULL,
  "session_id"      TEXT NOT NULL,
  "path"            TEXT NOT NULL,
  "referrer_domain" TEXT,
  "utm_source"      TEXT,
  "country"         TEXT,
  -- "mobile" | "tablet" | "desktop", derived server-side from the UA and then
  -- the UA itself is thrown away.
  "device"          TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every dashboard query is "recent activity, newest first": live visitors in
-- the last 5 minutes, today's views, today's top pages.
CREATE INDEX "page_views_created_at_idx" ON "page_views" ("created_at" DESC);
-- Distinct-visitor and distinct-session counts over a window.
CREATE INDEX "page_views_visitor_id_created_at_idx" ON "page_views" ("visitor_id", "created_at" DESC);
CREATE INDEX "page_views_session_id_created_at_idx" ON "page_views" ("session_id", "created_at" DESC);
