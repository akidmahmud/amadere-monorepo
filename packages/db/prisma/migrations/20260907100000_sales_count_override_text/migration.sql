-- "N people bought" override becomes display copy rather than a number.
--
-- An Int could only ever say what the compact formatter chose to render
-- (1200 -> "1.2k"); staff want to write the badge itself — "1k", "1.5k",
-- "2k+". USING keeps any existing value: 1500 becomes the string '1500',
-- which still renders, so nothing needs backfilling.
ALTER TABLE "products"
  ALTER COLUMN "sales_count_override" TYPE VARCHAR(24)
  USING "sales_count_override"::text;
