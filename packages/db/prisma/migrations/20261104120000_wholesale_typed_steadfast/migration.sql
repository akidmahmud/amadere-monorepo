-- Orders saved as courier "Other" with one of our couriers' names typed in
-- (e.g. "steadfast") never got that courier's handling: a Steadfast one was
-- never booked and never showed in Shipments. Point them at the real courier.
UPDATE "wholesale_orders"
SET "courier" = CASE regexp_replace(lower("courier_name"), 'courier|[^a-z]', '', 'g')
    WHEN 'steadfast' THEN 'STEADFAST'::"WholesaleCourier"
    WHEN 'sundarban' THEN 'SUNDARBAN'::"WholesaleCourier"
    WHEN 'sundorbon' THEN 'SUNDARBAN'::"WholesaleCourier"
    WHEN 'ajr' THEN 'AJR'::"WholesaleCourier"
    WHEN 'saparibahan' THEN 'SA_PARIBAHAN'::"WholesaleCourier"
  END,
  "courier_name" = NULL
WHERE "courier" = 'OTHER'
  AND regexp_replace(lower("courier_name"), 'courier|[^a-z]', '', 'g')
      IN ('steadfast', 'sundarban', 'sundorbon', 'ajr', 'saparibahan');
