import { useMutation } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Anonymous, email-only — not tied to a customer account at all
// (`NewsletterSubscriber` is its own model keyed by email, no link to
// `Customer`), so this works the same whether the visitor is logged in or not.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: that hostname is unreachable from
// a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin proxy
// answers in ~0.4s. Same-origin also cannot fail this way in principle — the
// request rides the hostname, certificate and CDN edge that already served
// the HTML.
export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: (email: string) =>
      proxyFetch<unknown>("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  });
}
