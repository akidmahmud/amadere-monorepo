import { useMutation } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Anonymous, unauthenticated — fired once per visitor per post by
// BlogViewTracker (client-side, cookie-gated so repeat visits/refreshes
// don't recount). Throttled server-side too since this is a public write
// endpoint with no auth.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: that hostname is unreachable from
// a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin proxy
// answers in ~0.4s. Same-origin also cannot fail this way in principle — the
// request rides the hostname, certificate and CDN edge that already served
// the HTML.
export function useRecordBlogPostView() {
  return useMutation({
    mutationFn: (slug: string) =>
      proxyFetch<unknown>(`/blog-posts/${encodeURIComponent(slug)}/view`, {
        method: "POST",
      }),
  });
}
