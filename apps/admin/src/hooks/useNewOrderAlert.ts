"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { ting } from "@/lib/ting";
import type { AdminOrder } from "@/hooks/useOrders";

/**
 * Rings and lists the newest orders in the header bell.
 *
 * Reuses the admin orders list rather than adding a "recent" route: it is
 * already the exact set the Orders page shows, newest first, so the bell can
 * never disagree with the page it links to — the same reasoning
 * useAbandonmentAlert applies to the recovery list.
 */

const SEEN_KEY = "amader:orders-seen-newest-id";
/** Faster than the abandoned-cart poll: a new order IS time-sensitive. */
const POLL_MS = 30_000;
const PAGE_SIZE = 10;

export interface NewOrderNotification {
  id: number;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  unread: boolean;
}

function readSeen(): number | null {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    // Storage blocked — the in-memory priming below still keeps the bell from
    // screaming about every order placed before this tab opened.
    return null;
  }
}

function writeSeen(id: number) {
  try {
    sessionStorage.setItem(SEEN_KEY, String(id));
  } catch {
    /* ignored — see readSeen */
  }
}

export function useNewOrderAlert(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["new-order-alert"],
    queryFn: () =>
      proxyFetch<{ items: AdminOrder[]; total: number }>(
        `/admin/orders?page=1&pageSize=${PAGE_SIZE}`,
      ),
    enabled,
    refetchInterval: POLL_MS,
    // The whole point is freshness; a cached list would silence the bell.
    staleTime: 0,
    retry: false,
  });

  const orders = useMemo(() => (enabled ? (data?.items ?? []) : []), [enabled, data]);
  // Ids are monotonic, so the largest is the newest — more reliable than
  // trusting list order, and unlike a count it does not go backwards when an
  // order is deleted.
  const newestId = orders.length > 0 ? Math.max(...orders.map((o) => o.id)) : null;

  const [seenId, setSeenId] = useState<number | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled || newestId === null) return;

    const stored = readSeen();

    // First reading of the session sets the baseline. Without it the bell
    // would announce every one of the last ten orders on each page load.
    if (stored === null || !primed.current) {
      primed.current = true;
      if (stored === null) {
        writeSeen(newestId);
        setSeenId(newestId);
        return;
      }
      setSeenId(stored);
    }

    const baseline = stored ?? newestId;
    if (newestId > baseline) {
      setSeenId(baseline);
      ting();
    }
  }, [enabled, newestId]);

  const notifications: NewOrderNotification[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    totalAmount: String(o.totalAmount),
    currency: o.currency,
    createdAt: o.createdAt,
    unread: seenId !== null && o.id > seenId,
  }));

  const unseen = notifications.filter((n) => n.unread).length;

  /** Called when the bell panel is opened — everything listed counts as seen. */
  const acknowledge = useCallback(() => {
    if (newestId === null) return;
    writeSeen(newestId);
    setSeenId(newestId);
  }, [newestId]);

  return { notifications, unseen, acknowledge };
}
