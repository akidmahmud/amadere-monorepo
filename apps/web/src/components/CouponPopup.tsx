"use client";

import { useEffect } from "react";

export interface CouponUnavailableDetails {
  couponUnavailable: true;
  /** ALREADY_REDEEMED = this mobile number/account already used it; USED_UP = total limit reached. */
  reason: "ALREADY_REDEEMED" | "USED_UP";
  heading: string;
  sub: string;
}

export function isCouponUnavailable(details: unknown): details is CouponUnavailableDetails {
  return (
    !!details && typeof details === "object" && (details as { couponUnavailable?: unknown }).couponUnavailable === true
  );
}

// Checkout refused because the coupon was already redeemed with this mobile
// number (or its uses ran out). The order itself is fine, so the one useful
// action is offered: drop the coupon and place it at the regular price.
// Same shell as BlockPopup so the two feel like one system.
export function CouponPopup({
  details,
  removing,
  onRemove,
  onClose,
}: {
  details: CouponUnavailableDetails;
  removing: boolean;
  onRemove: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-popup-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-brand border border-line bg-white p-6 text-center shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-beige"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 1 1 13M1 1l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>

        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-beige text-green">
          {/* ticket */}
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4a2 2 0 0 1 0 4v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 1 0-4Zm-9 7.5h-2v-2h2v2Zm0-4.5h-2v-2h2v2Zm0-4.5h-2v-2h2v2Z" />
          </svg>
        </div>

        <h3 id="coupon-popup-title" className="font-ui text-lg font-bold text-ink">
          {details.heading}
        </h3>
        <p className="mt-1 font-body text-sm text-muted">{details.sub}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="h-11 rounded-full bg-green px-5 font-ui text-sm font-bold text-white disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove coupon & continue"}
          </button>
          <button type="button" onClick={onClose} className="h-10 font-ui text-sm font-semibold text-muted hover:text-ink">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
