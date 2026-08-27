import { NextResponse } from "next/server";

/**
 * Public catalog feeds, served from the storefront origin.
 *
 * Meta, Google and TikTok are each given one URL to poll forever, and it has
 * to live on amadere.com — the API is on a different origin, and a feed URL
 * pointing at api.* would tie the ad accounts to an internal hostname that
 * can never be changed afterwards without re-ingesting the whole catalogue.
 *
 * So this is a thin pass-through: the backend owns the generation and the
 * caching, this owns the public address.
 */

const UPSTREAM: Record<string, { path: string; contentType: string }> = {
  meta: { path: "meta", contentType: "application/json; charset=utf-8" },
  google: { path: "google", contentType: "application/xml; charset=utf-8" },
  tiktok: { path: "tiktok", contentType: "text/tab-separated-values; charset=utf-8" },
};

// Never statically rendered: the whole point is that a platform polling this
// gets current stock and prices.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const target = UPSTREAM[platform];
  if (!target) {
    return NextResponse.json({ error: "Unknown feed" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
  const upstream = await fetch(`${base}/api/v1/feed/${target.path}`, {
    // The backend already caches the built feed for 30 minutes and drops it
    // on any product write; caching again here would only add a second,
    // independent staleness window nobody can see or purge.
    cache: "no-store",
  });

  if (!upstream.ok) {
    // A plain 502 rather than an empty but well-formed feed: an empty feed
    // reads as "this shop has no products" and the platforms will disable
    // every ad using the catalogue.
    return NextResponse.json(
      { error: "Feed upstream unavailable" },
      { status: 502 },
    );
  }

  return new NextResponse(await upstream.text(), {
    status: 200,
    headers: {
      "Content-Type": target.contentType,
      "Cache-Control": "public, max-age=1800",
    },
  });
}
