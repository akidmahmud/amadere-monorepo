"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

/**
 * Rings when a new abandoned cart appears.
 *
 * Reuses the recovery list endpoint rather than adding a "count" route: it
 * already returns `total` for the exact set the Recovery page shows — not
 * recovered, and contactable — so the bell can never disagree with the page
 * it links to.
 */

const SEEN_KEY = "amader:abandonment-seen-total";
/** Slow on purpose: an abandoned cart is not an emergency. */
const POLL_MS = 60_000;

/**
 * A short "ting", synthesised rather than shipped as an audio file.
 *
 * Two decaying sine partials (988Hz + its octave) through a gain envelope —
 * a bell is close enough to that for the four hundred bytes it costs, and it
 * avoids adding a binary asset that has to be hosted, cached and kept in the
 * repo forever.
 */
function ting() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    // Browsers start the context suspended until a user gesture. An admin has
    // invariably clicked something by the time a poll fires, but resume() is
    // cheap insurance and silently no-ops when it is already running.
    void ctx.resume?.();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    gain.connect(ctx.destination);

    for (const [freq, level] of [
      [988, 1],
      [1976, 0.35],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, now);
      osc.connect(g).connect(gain);
      osc.start(now);
      osc.stop(now + 1.2);
    }
    // Free the hardware context rather than leaking one per ring.
    setTimeout(() => void ctx.close?.(), 1500);
  } catch {
    // Audio is a nicety. A blocked or unsupported context must never break
    // the admin shell it is mounted in.
  }
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
        "/admin/net-profit/recovery?recovered=false&page=1&pageSize=1",
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
