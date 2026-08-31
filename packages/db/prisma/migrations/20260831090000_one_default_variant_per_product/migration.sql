-- "Exactly one default variant per product" was enforced only by application
-- code, and only in setDefaultVariant(). Adding a variant with Default ticked
-- wrote is_default = true without clearing the existing one, so a product
-- could end up showing two "(default)" variants — and every read path
-- (`variants.find(v => v.isDefault) ?? variants[0]`) then silently resolves
-- the tie by row order, meaning the card, the PDP and the catalog feed could
-- price from a different variant than the admin sees selected.
--
-- The service now clears the old default on every write path. This index is
-- the backstop, so no future path can reintroduce it.
--
-- Products with NO default are deliberately left alone: that is already a
-- supported state (the `?? variants[0]` fallback), and 16 existing products
-- are in it. This forbids two, not zero.
--
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).
-- Prisma's schema cannot express a partial unique index, so this index is
-- intentionally invisible to schema.prisma.

-- Existing duplicates first, or the index cannot be built. Keeps the
-- lowest-id default and clears the rest: which one the admin actually meant
-- is unknowable, and "Make default" fixes it in one click.
UPDATE product_variants v
SET is_default = false
WHERE v.is_default
  AND v.id <> (
    SELECT MIN(inner_v.id)
    FROM product_variants inner_v
    WHERE inner_v.product_id = v.product_id
      AND inner_v.is_default
  );

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_one_default_per_product
  ON product_variants (product_id)
  WHERE is_default;
