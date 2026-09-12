-- The birthday nudge asked again on every visit to the profile page, because
-- "dismissed" lived only in React state. This records the dismissal against
-- the ACCOUNT rather than the browser, so it does not come back on the
-- customer's phone after they closed it on a laptop.
--
-- Null for every existing customer, which is correct: anyone who has not been
-- asked yet gets exactly one prompt, then never again.
ALTER TABLE "customers" ADD COLUMN "birthday_prompted_at" TIMESTAMP(3);
