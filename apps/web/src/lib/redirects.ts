import { permanentRedirect } from "@/i18n/navigation";
import { safeGet } from "@/lib/api/client";

// The backend's Redirect table holds ~1,900 real old→new URL mappings from
// the B12 migration. Checked here, per-request, only for paths that already
// failed to resolve against every real route this app has — not middleware,
// not a bulk in-memory cache: at this point in the render, the alternative
// is already notFound(), so one more network call is the right trade, and it
// keeps the redirect map as the single source of truth the backend owns.
//
// ⚠ Uses next-intl's own `permanentRedirect` (from `@/i18n/navigation`), not
// the raw `next/navigation` one — confirmed live that the raw version
// silently degrades to a client-side-only redirect (HTTP 200, JS navigation)
// under this app's locale-routing setup, while next-intl's locale-aware
// wrapper produces a real HTTP 308. Same root cause class as the documented
// notFound()-vs-streaming quirk (AGENTS.web.md §14, F4) — a real Next.js/
// next-intl interaction to know about, not a one-off bug in this function.
export async function redirectIfMapped(path: string, locale: string): Promise<never | void> {
  // The Redirect table only ever holds page paths — an API-shaped path here
  // means something upstream is misrouted (e.g. NEXT_PUBLIC_API_BASE_URL
  // pointing at this app's own origin instead of the backend's). Bail out
  // instead of asking the resolve endpoint about itself.
  if (path.startsWith("/api/")) return;

  const res = await safeGet("/api/v1/redirects/resolve", { params: { query: { path } } });
  if (res.data?.redirect) {
    permanentRedirect({ href: res.data.toPath, locale });
  }
}
