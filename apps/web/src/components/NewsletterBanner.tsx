"use client";

import { useState } from "react";
import { useSubscribeNewsletter } from "@/hooks/useNewsletter";

const planeIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// Matches amadere.com's homepage promo strip (paper-plane icon + pill email
// field + dark-green pill button inside a soft mint banner) — simplified to
// this app's own token palette (--color-green) rather than the reference's
// exact hex, and without its right-side lifestyle photo (no matching asset
// in this codebase).
export function NewsletterBanner() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const subscribe = useSubscribeNewsletter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    subscribe.mutate(email, {
      onSuccess: () => {
        setMessage("Thanks for subscribing!");
        setEmail("");
      },
      onError: () => setMessage("Something went wrong. Please try again."),
    });
  }

  return (
    <div className="rounded-brand bg-green/10 px-6 py-8 md:px-10 md:py-10">
      <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* w-full + sm:flex-1 (not a bare flex-1) — inside a flex-col form
            with no fixed height, flex-1's flex-basis:0 overrides the
            explicit height on the column's main (vertical) axis, collapsing
            this to a fraction of its intended height. sm:flex-row's main
            axis is horizontal, where flex-1 is fine and needed to fill
            remaining width next to the button. 54px/16px/40px below are
            amadere.com's own measured pill height, font size, and button
            padding — matched exactly, not eyeballed. */}
        <div className="flex h-[54px] w-full items-center gap-2.5 rounded-full bg-white px-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)] sm:w-auto sm:flex-1">
          <span className="shrink-0 text-green">{planeIcon}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Your Email"
            className="h-full flex-1 bg-transparent font-body text-base text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="h-[54px] shrink-0 rounded-full bg-green px-10 font-ui text-base font-bold text-white transition-colors hover:bg-green-dark disabled:opacity-60"
        >
          {subscribe.isPending ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {message && <p className="mt-2.5 font-body text-sm text-muted">{message}</p>}
    </div>
  );
}
