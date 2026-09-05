"use client";

import { useState } from "react";
import { useSubscribeNewsletter } from "@/hooks/useNewsletter";

const planeIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export interface NewsletterBannerProps {
  /** 1600×500 artwork. Without it this falls back to the original flat mint
   *  strip, so an unconfigured section still renders something sane. */
  imageUrl?: string | null;
  /** Phones only. The desktop banner is 3.2:1 — about 120px tall on a phone,
   *  which cannot hold a legible email field and button. Falls back to the
   *  desktop image when not set. */
  mobileImageUrl?: string | null;
  heading?: string | null;
  subheading?: string | null;
  /** Off by default: the artwork is designed, and darkening it is not
   *  something to do to someone's banner unless they ask. */
  darkOverlay?: boolean;
  /** Heading/subheading colour. Defaults to dark on bare artwork and light
   *  over the overlay — white text on a pale banner is unreadable, which is
   *  the trap the overlay used to hide. */
  textColor?: "LIGHT" | "DARK";
}

// Homepage email capture. Originally a flat mint strip (no artwork existed);
// now the artwork is admin-uploadable and the form sits on top of it.
export function NewsletterBanner({
  imageUrl,
  mobileImageUrl,
  heading,
  subheading,
  darkOverlay = false,
  textColor,
}: NewsletterBannerProps = {}) {
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

  const hasImage = Boolean(imageUrl);
  const mobileSrc = mobileImageUrl || imageUrl;
  // Light text only where something actually darkens the background: over the
  // overlay, or when the admin says the artwork is dark. On the plain mint
  // fallback, and on bare light artwork, ink.
  const light = hasImage && (textColor ? textColor === "LIGHT" : darkOverlay);
  // A shadow lifts light text off busy artwork without dimming the whole
  // image the way the overlay does.
  const shadow = light && !darkOverlay ? { textShadow: "0 1px 3px rgba(0,0,0,0.55)" } : undefined;

  return (
    <div className="relative overflow-hidden rounded-brand bg-green/10">
      {hasImage && (
        <>
          {/* Two <img> rather than one with object-position: the desktop
              banner is 3.2:1 and the mobile one is near-square, so there is
              no single crop that serves both. Aspect ratios are pinned so
              the block does not jump while the image loads. */}
          <img
            src={mobileSrc ?? ""}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover md:hidden"
            loading="lazy"
          />
          <img
            src={imageUrl ?? ""}
            alt=""
            aria-hidden
            className="absolute inset-0 hidden h-full w-full object-cover md:block"
            loading="lazy"
          />
          {darkOverlay && (
            // Opt-in, and bottom-weighted where the form sits — a flat wash
            // over the whole image would grey out the artwork for no reason.
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" />
          )}
        </>
      )}

      <div
        className={
          hasImage
            ? "relative flex aspect-square flex-col justify-end px-6 py-8 md:aspect-[16/5] md:justify-center md:px-10"
            : "relative px-6 py-8 md:px-10 md:py-10"
        }
      >
        {heading && (
          <h2
            className={`font-ui text-2xl font-extrabold md:text-3xl ${light ? "text-white" : "text-ink"}`}
            style={shadow}
          >
            {heading}
          </h2>
        )}
        {subheading && (
          <p
            className={`mt-1.5 font-body text-sm md:text-base ${light ? "text-white/90" : "text-muted"}`}
            style={shadow}
          >
            {subheading}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className={`flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${heading || subheading ? "mt-4" : ""}`}
        >
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
        {message && (
          <p className={`mt-2.5 font-body text-sm ${light ? "text-white" : "text-muted"}`}>{message}</p>
        )}
      </div>
    </div>
  );
}
