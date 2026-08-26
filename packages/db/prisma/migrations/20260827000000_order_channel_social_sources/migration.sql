-- Social sales channels for manually-entered orders.
-- Hand-written rather than generated: `prisma migrate dev` cannot run in this
-- repo (a pre-existing FK violation in 20260807103916_promo_videos_standalone
-- fails the shadow database), so this is applied with `migrate deploy`.
ALTER TYPE "OrderChannel" ADD VALUE 'FACEBOOK';
ALTER TYPE "OrderChannel" ADD VALUE 'INSTAGRAM';
ALTER TYPE "OrderChannel" ADD VALUE 'TIKTOK';
ALTER TYPE "OrderChannel" ADD VALUE 'YOUTUBE';
ALTER TYPE "OrderChannel" ADD VALUE 'X';
