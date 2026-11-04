-- Old uploads point at the bucket's pub-*.r2.dev address, which is
-- rate-limited and bypasses the cdn.amadere.com Worker that falls back to the
-- VPS mirror when R2 is down. Same files, same keys: only the host changes.
UPDATE "media"
SET "url"      = regexp_replace("url",      '^https://pub-[a-z0-9]+\.r2\.dev/', 'https://cdn.amadere.com/'),
    "card_url" = regexp_replace("card_url", '^https://pub-[a-z0-9]+\.r2\.dev/', 'https://cdn.amadere.com/'),
    "full_url" = regexp_replace("full_url", '^https://pub-[a-z0-9]+\.r2\.dev/', 'https://cdn.amadere.com/')
WHERE "url" ~ '^https://pub-[a-z0-9]+\.r2\.dev/'
   OR "card_url" ~ '^https://pub-[a-z0-9]+\.r2\.dev/'
   OR "full_url" ~ '^https://pub-[a-z0-9]+\.r2\.dev/';
