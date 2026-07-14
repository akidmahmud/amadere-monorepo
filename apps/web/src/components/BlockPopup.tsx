"use client";

import { useEffect } from "react";

export interface BlockPopupDetails {
  blocked: true;
  heading?: string;
  sub?: string;
  reason?: string;
  contacts?: { call?: string; whatsapp?: string; email?: string };
}

// Net Profit Blocker Manager's checkout-block pop-up (parity with the
// reference plugin's wpfok-block-overlay) — shown when checkout is
// rejected by a manual or auto-triggered block rule. Reads the structured
// `error.details` payload the backend attaches to that specific 403 (see
// ApiError.details / HttpExceptionFilter), not just the flat message.
export function BlockPopup({ details, onClose }: { details: BlockPopupDetails; onClose: () => void }) {
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

  const { heading, sub, reason, contacts } = details;
  const callHref = contacts?.call ? `tel:${contacts.call}` : undefined;
  const waHref = contacts?.whatsapp ? `https://wa.me/${contacts.whatsapp.replace(/\D+/g, "")}` : undefined;
  const emailHref = contacts?.email ? `mailto:${contacts.email}` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
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
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </div>

        <h3 className="font-ui text-lg font-bold text-ink">{heading || "We could not accept this order"}</h3>
        {sub && <p className="mt-1 font-body text-sm text-muted">{sub}</p>}
        {reason && (
          <p className="mt-3 rounded-[10px] bg-beige/60 px-3 py-2 font-body text-sm text-ink">{reason}</p>
        )}

        {(callHref || waHref || emailHref) && (
          <div className="mt-4 flex flex-col gap-2">
            {callHref && (
              <a href={callHref} className="flex items-center gap-3 rounded-[10px] border border-line px-4 py-2.5 text-left hover:bg-beige/40">
                <span className="text-lg">📞</span>
                <span className="flex flex-col">
                  <span className="font-ui text-sm font-semibold text-ink">Call us</span>
                  <span className="font-body text-xs text-muted">{details.contacts?.call}</span>
                </span>
              </a>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[10px] border border-line px-4 py-2.5 text-left hover:bg-beige/40">
                <span className="text-lg">💬</span>
                <span className="flex flex-col">
                  <span className="font-ui text-sm font-semibold text-ink">WhatsApp</span>
                  <span className="font-body text-xs text-muted">Message us</span>
                </span>
              </a>
            )}
            {emailHref && (
              <a href={emailHref} className="flex items-center gap-3 rounded-[10px] border border-line px-4 py-2.5 text-left hover:bg-beige/40">
                <span className="text-lg">📧</span>
                <span className="flex flex-col">
                  <span className="font-ui text-sm font-semibold text-ink">Email us</span>
                  <span className="font-body text-xs text-muted">{details.contacts?.email}</span>
                </span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
