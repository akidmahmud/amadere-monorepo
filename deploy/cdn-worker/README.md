# Image fallback (cdn.amadere.com)

Every upload is stored in R2 **and** on the VPS (`MEDIA_MIRROR_DIR`). If R2
stops answering, this Worker serves the VPS copy; uploads made during the
outage are pushed to R2 automatically every 5 minutes once it is back.

## One-time setup

1. **Server `.env`** (repo root): `MEDIA_MIRROR_DIR=/var/www/amadere-media`,
   then `mkdir -p /var/www/amadere-media` and restart the backend.
2. **Copy existing files** (needs R2 working):
   `MEDIA_MIRROR_DIR=/var/www/amadere-media pnpm --filter @amader/db mirror:r2`
   Re-runnable; skips files already copied.
3. **Check** `https://api.amadere.com/media-mirror/image/<any key>` opens an image.
4. **Cloudflare -> Workers & Pages -> Create Worker**, paste `worker.js`,
   deploy. Settings -> Variables: `MIRROR_ORIGIN = https://api.amadere.com`.
   Settings -> Domains & Routes -> Add route `cdn.amadere.com/*` (zone amadere.com).
5. **Test**: open any image on cdn.amadere.com — it must still load. A
   resized one too (`https://cdn.amadere.com/cdn-cgi/image/width=320/image/<key>`).

Free Workers plan = 100k requests/day; switch to Workers Paid ($5/mo) if the
dashboard shows you near that.
