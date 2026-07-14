// Same proxy rationale as sitemap.xml/route.ts.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// See sitemap.xml/route.ts — not prerendered, for the same build-time-
// resilience reason (confirmed live: a static route here crashed the build
// when the backend was briefly unreachable).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/robots.txt`);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch {
    return new Response("User-agent: *\nDisallow:\n", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
