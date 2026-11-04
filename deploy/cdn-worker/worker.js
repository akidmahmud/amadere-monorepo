// Cloudflare Worker on the route cdn.amadere.com/*
//
// Normally a pass-through to R2 (the bucket's custom domain). When R2 does
// not answer with the file (403/5xx, e.g. the R2 subscription was dropped on
// 2026-11-04 and every uncached image broke), it serves the copy the backend
// keeps on the VPS (MirroredMediaStorage, served at /media-mirror/<key>).
//
// Env var (Settings -> Variables): MIRROR_ORIGIN = https://api.amadere.com

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return fetch(request);

    let r2;
    try {
      r2 = await fetch(request);
    } catch {
      r2 = null;
    }
    if (r2 && (r2.ok || r2.status === 304)) return r2;

    const url = new URL(request.url);
    const origin = (env.MIRROR_ORIGIN || 'https://api.amadere.com').replace(/\/$/, '');
    const mirror = await fetch(`${origin}/media-mirror${url.pathname}`, {
      method: request.method,
      // Cache the fallback at the edge for an hour, so an outage does not
      // send every image view to the VPS.
      cf: { cacheEverything: true, cacheTtl: 3600 },
    });
    if (mirror.ok) {
      const res = new Response(mirror.body, mirror);
      res.headers.set('x-served-from', 'vps-mirror');
      return res;
    }
    return r2 ?? mirror;
  },
};
