"use client";

import { useEffect, useRef, useState } from "react";
import { getGuestToken } from "@/lib/guest-token";

/**
 * Asks for notification permission — but only after the shopper has shown
 * interest, and only once.
 *
 * The browser gives a site exactly one chance: a denial is permanent until the
 * customer digs into site settings to undo it. So this never fires on page
 * load. It waits for a real signal (`amader:push-trigger`, dispatched on
 * add-to-cart) and then shows OUR prompt first. The browser's own permission
 * dialog is only opened if they say yes to ours — a "not now" costs nothing and
 * can be asked again another day.
 */

const DISMISSED_KEY = "amader:push-asked";
/** Long enough that a "not now" is respected, short enough to try again in a
 *  later shopping session. */
const ASK_AGAIN_AFTER_DAYS = 30;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  // VAPID keys travel as URL-safe base64; PushManager wants raw bytes.
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function recentlyAsked(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    if (!at) return false;
    return Date.now() - at < ASK_AGAIN_AFTER_DAYS * 86_400_000;
  } catch {
    // Storage blocked — treat as never asked. Worst case they see the card once
    // per session, which is better than never being able to opt in at all.
    return false;
  }
}

export function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"granted" | "denied" | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    // Feature-gate before anything else. On iOS this is false unless the site
    // was added to the Home Screen, which is why push there is effectively
    // opt-in-by-installation.
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return;
    if (Notification.permission !== "default") return; // already decided
    if (recentlyAsked()) return;

    function onTrigger() {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
    }

    window.addEventListener("amader:push-trigger", onTrigger);
    return () => window.removeEventListener("amader:push-trigger", onTrigger);
  }, []);

  function remember() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* storage blocked — nothing to remember with */
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const keyRes = await fetch("/api/backend/push/public-key");
      const keyJson = await keyRes.json();
      const publicKey: string | null = keyJson?.data?.publicKey ?? keyJson?.publicKey ?? null;
      if (!publicKey) {
        // Not configured yet. Say nothing to the shopper and don't burn their
        // one permission prompt on a subscription we cannot deliver to.
        setVisible(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDone("denied");
        remember();
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          // Required by Chrome: every push must result in a visible
          // notification. Silent background push is not allowed.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const json = subscription.toJSON() as {
        keys?: { p256dh?: string; auth?: string };
      };
      await fetch("/api/backend/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          // The cart identity. Without it an abandoned cart from a shopper who
          // never signed in has no way back to this browser — which is almost
          // every abandoned cart.
          guestToken: getGuestToken(),
          locale: document.documentElement.lang === "bn" ? "BN" : "EN",
        }),
      });

      setDone("granted");
      remember();
    } catch {
      // A failed opt-in is not worth an error message — the shopper did not ask
      // for this. Close quietly and try again in a later session.
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  // Sits ABOVE MobileStickyFooter, which is fixed bottom-0 at z-[1000] and is
  // 62px tall on mobile. At the old bottom-4/z-50 the footer painted over this
  // card's buttons, so a shopper on a phone could not dismiss it at all.
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Order updates"
      className="fixed bottom-[78px] left-4 right-4 z-[1001] mx-auto max-w-sm rounded-[14px] border border-line bg-white p-4 shadow-brand md:bottom-6 md:left-auto md:right-6"
    >
      {/* An explicit dismiss. "Not now" alone was not enough: it is easy to
          miss, and on a phone it was the part hidden behind the footer. */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          remember();
          setVisible(false);
        }}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted transition-colors hover:bg-line/60 hover:text-ink"
      >
        &times;
      </button>
      {done === "granted" ? (
        <div className="flex items-start gap-3">
          <p className="flex-1 font-body text-sm text-ink">
            Done — we&apos;ll let you know about your order and when your favourites are back.
          </p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="font-body text-sm font-semibold text-green"
          >
            Close
          </button>
        </div>
      ) : done === "denied" ? (
        <div className="flex items-start gap-3">
          <p className="flex-1 font-body text-sm text-ink">
            No problem. You can turn notifications on any time from your browser settings.
          </p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="font-body text-sm font-semibold text-green"
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <p className="pr-8 font-body text-sm font-semibold text-ink">
            Get order updates from Amader™
          </p>
          <p className="mt-1 font-body text-sm text-muted">
            Delivery updates, and a reminder when something you left in your cart is
            about to sell out. No marketing spam.
          </p>
          <div className="mt-3.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-[10px] bg-green px-4 font-body text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Just a moment…" : "Yes, notify me"}
            </button>
            <button
              type="button"
              onClick={() => {
                remember();
                setVisible(false);
              }}
              className="inline-flex h-10 items-center rounded-[10px] px-3 font-body text-sm font-semibold text-muted"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
