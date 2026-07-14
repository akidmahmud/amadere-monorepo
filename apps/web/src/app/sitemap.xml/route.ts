// Proxies the backend's own generated sitemap verbatim — per AGENTS.web.md
// §8 ("the backend generates the XML sitemap — reference/proxy it"), this
// app does not recompute it. Using a literal `sitemap.xml` route-segment
// folder (not Next's `app/sitemap.ts` MetadataRoute convention) on purpose:
// that convention expects an array of URL entries to build XML *from*,
// which would mean re-deriving what the backend already computes correctly.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Not prerendered at build time — same build-time-resilience rule as
// safeGet() (F3): a static route here would call fetch() during `next build`
// and take the whole build down if the backend is briefly unreachable
// (confirmed live — this crashed a real build before this line was added).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/sitemap.xml`);
    const xml = await res.text();
    return new Response(xml, {
      status: res.status,
      headers: { "Content-Type": "application/xml" },
    });
  } catch {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  }
}
