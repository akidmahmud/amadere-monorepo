"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { IncompleteOrder } from "@/hooks/useRecovery";
import { ting } from "@/lib/ting";

/**
 * Rings when a new abandoned cart appears.
 *
 * Reuses the recovery list endpoint rather than adding a "count" route: it
 * already returns `total` for the exact set the Recovery page shows — open
 * (neither recovered nor cancelled) and contactable — so the bell can never
 * disagree with the page it links to.
 */

const SEEN_KEY = "amader:abandonment-seen-total";
/** Slow on purpose: an abandoned cart is not an emergency. */
const POLL_MS = 60_000;

/**
 * The abandoned carts themselves, for the bell's dropdown.
 *
 * Deliberately separate from the count poll above and gated on `enabled`,
 * which the shell only turns on once the panel has actually been opened:
 * these rows carry cart snapshots, and fetching them every minute for every
 * admin merely to keep a dropdown warm is the exact cost the count poll
 * exists to avoid.
 */
export function useAbandonedCartNotifications(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["abandonment-notifications"],
    queryFn: () =>
      proxyFetch<{ items: IncompleteOrder[] }>(
        "/admin/net-profit/recovery?outcome=open&page=1&pageSize=5",
      ),
    enabled,
    refetchInterval: POLL_MS,
    staleTime: 0,
    retry: false,
  });
  return enabled ? (data?.items ?? []) : [];
}

export function useAbandonmentAlert(enabled: boolean) {
  // Its own query, not the Recovery page's: this one polls, and making the
  // page's list poll as a side effect would refetch twenty rows and their
  // cart snapshots every minute for anyone sitting on it.
  //
  // pageSize 1 because only `total` is read.
  const { data } = useQuery({
    queryKey: ["abandonment-alert"],
    queryFn: () =>
      proxyFetch<{ total: number }>(
        // outcome=open, matching the Recovery page's own default. `recovered=false`
        // was equivalent until carts could be CANCELLED — after that it still
        // counted cancelled rows, so the bell would ring for a cart staff had
        // already closed and which the page it links to no longer lists.
        "/admin/net-profit/recovery?outcome=open&page=1&pageSize=1",
      ),
    enabled,
    refetchInterval: POLL_MS,
    // The count is the whole point; a stale one would silence the bell.
    staleTime: 0,
    retry: false,
  });
  const total = enabled ? (data?.total ?? null) : null;

  const [unseen, setUnseen] = useState(0);
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled || total === null) return;

    let seen: number | null = null;
    try {
      const raw = sessionStorage.getItem(SEEN_KEY);
      seen = raw === null ? null : Number(raw);
    } catch {
      // Storage blocked — fall back to in-memory priming below.
    }

    // First reading of the session establishes the baseline. Without this the
    // bell would ring on every page load for carts abandoned days ago.
    if (seen === null || !primed.current) {
      primed.current = true;
      if (seen === null) {
        try {
          sessionStorage.setItem(SEEN_KEY, String(total));
        } catch {
          /* ignored */
        }
        setUnseen(0);
        return;
      }
    }

    if (total > seen) {
      setUnseen(total - seen);
      ting();
    } else if (total < seen) {
      // Rows were recovered or deleted — re-baseline so the next genuinely
      // new cart still rings.
      try {
        sessionStorage.setItem(SEEN_KEY, String(total));
      } catch {
        /* ignored */
      }
      setUnseen(0);
    }
  }, [total, enabled]);

  /** Called when the admin opens the Recovery page from the bell. */
  function acknowledge() {
    if (total !== null) {
      try {
        sessionStorage.setItem(SEEN_KEY, String(total));
      } catch {
        /* ignored */
      }
    }
    setUnseen(0);
  }

  return { unseen, acknowledge, pollMs: POLL_MS };
}
