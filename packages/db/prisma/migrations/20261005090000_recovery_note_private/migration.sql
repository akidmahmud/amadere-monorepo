-- "Recreated from an abandoned cart by staff." is internal: move it from the
-- customer note (sent to the courier) to the private staff note.
UPDATE "orders"
SET "staff_note" = CASE
      WHEN "staff_note" IS NULL OR "staff_note" = '' THEN 'Recreated from an abandoned cart by staff.'
      ELSE "staff_note" || E'\n' ||'Recreated from an abandoned cart by staff.'
    END,
    "customer_note" = NULL
WHERE "customer_note" = 'Recreated from an abandoned cart by staff.';
