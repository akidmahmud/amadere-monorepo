"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

const VISITOR_KEY = "amader_vid";
const SESSION_KEY = "amader_sid";

/**
 * A random id, remembered where the caller says.
 *
 * localStorage survives between visits, so it counts PEOPLE; sessionStorage
 * dies with the tab, so it counts VISITS. Both are meaningless on their own —
 * no name, no IP, nothing that ties back to a person.
 *
 * Wrapped in try/catch because storage throws outright in some privacy modes.
 * When it does we still send the view with a throwaway id: the page-view count
 * stays right, and that visitor just looks new every time.
 */
function idFrom(store: "local" | "session", key: string): string {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    const existing = s.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    s.setItem(key, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Reports each page view to our own backend.
 *
 * This exists because the GA4/GTM/Meta/TikTok tags configured in the admin are
 * client-side pixels that report to Google and Meta — their numbers never
 * reach us, so the admin Overview had no traffic figure of its own to show.
 *
 * Being same-origin, it also survives the ad blockers that routinely eat
 * requests to analytics.google.com, so these numbers tend to run HIGHER than
 * GA's rather than lower.
 */
export function TrafficBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The App Router re-runs effects on things other than a navigation
  // (searchParams identity changes, Fast Refresh); without this guard the same
  // page would be counted several times.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({
      visitorId: idFrom("local", VISITOR_KEY),
      sessionId: idFrom("session", SESSION_KEY),
      path: pathname,
      referrer: document.referrer || undefined,
      utmSource: searchParams?.get("utm_source") || undefined,
    });

    // keepalive so the request still goes out if the view is the last thing
    // that happens before the tab closes. Failures are ignored on purpose —
    // a missed view is not worth an error in a shopper's console.
    void fetch(`${API_BASE}/api/v1/traffic/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
