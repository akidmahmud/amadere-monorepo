"use client";

import { useState } from "react";
import { getGuestToken } from "@/lib/guest-token";

/**
 * "Notify me when it's back" on a sold-out product.
 *
 * Delivered by push, so the address is the browser's own subscription endpoint
 * rather than an account — the shopper staring at a sold-out product is usually
 * not logged in, and asking them to register first would lose most of the people
 * this exists for.
 *
 * That means it may need the notification permission, which is why the button
 * says what it will do before it does it: one press subscribes the browser AND
 * registers the alert, and a refusal leaves nothing behind.
 */
export function BackInStockButton({
  productId,
  variantId,
}: {
  productId: number;
  variantId?: number;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "denied" | "unsupported">("idle");

  function toBytes(base64: string): Uint8Array {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(normalised);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function register() {
    setState("working");
    try {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // Most often an iPhone that has not been added to the Home Screen.
        setState("unsupported");
        return;
      }

      const keyRes = await fetch("/api/backend/push/public-key");
      const keyJson = await keyRes.json();
      const publicKey: string | null = keyJson?.data?.publicKey ?? keyJson?.publicKey ?? null;
      if (!publicKey) {
        setState("unsupported");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toBytes(publicKey) as BufferSource,
        }));
      const json = subscription.toJSON() as { keys?: { p256dh?: string; auth?: string } };

      // Store the subscription itself first — a stock alert is useless if the
      // endpoint it names is not on file.
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

      await fetch("/api/backend/push/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId,
          endpoint: subscription.endpoint,
          locale: document.documentElement.lang === "bn" ? "BN" : "EN",
        }),
      });

      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="mb-4 font-ui text-sm font-semibold text-green">
        We&apos;ll notify you the moment it&apos;s back.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="mb-4 font-body text-sm text-muted">
        Notifications are blocked for this site. Allow them in your browser settings to
        be told when this is back.
      </p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="mb-4 font-body text-sm text-muted">
        This browser can&apos;t receive restock alerts. On iPhone, add Amader™ to your
        Home Screen first.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={register}
      disabled={state === "working"}
      className="mb-4 inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-green px-5 font-ui text-sm font-bold text-green transition-colors hover:bg-green hover:text-white disabled:opacity-60 sm:w-auto"
    >
      {state === "working" ? "Setting up…" : "Notify me when it's back"}
    </button>
  );
}
