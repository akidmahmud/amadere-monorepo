"use client";

import { useEffect, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface AnnouncementItem {
  id: number;
  message: string;
  linkUrl?: string | null;
}

export interface AnnouncementBarProps {
  items: AnnouncementItem[];
  dismissLabel?: string;
  linkComponent?: LinkComponent;
}

const truckIcon = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 text-gold"
  >
    <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" />
    <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);

const closeIcon = (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DISMISS_KEY = "announceDismissed";

// CMS copy marks highlighted words with **double asterisks** (spec's own
// placeholder copy: "Enjoy **free delivery** on...") — split on that marker
// and render the bracketed segments in the spec's yellow/bold instead of a
// full markdown parser, since this is the only markdown feature the spec asks for.
function renderMessage(message: string) {
  return message.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <b key={i} className="font-bold text-gold">
        {part.slice(2, -2)}
      </b>
    ) : (
      part
    ),
  );
}

// Dismissing hides the bar until the announcement copy itself changes — the
// persisted value is the *current set* of messages, not an actual hash
// algorithm; string equality does the same job here with no extra code.
export function AnnouncementBar({
  items,
  dismissLabel = "Dismiss announcement",
  linkComponent: Link = DefaultLink,
}: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const signature = items.map((item) => item.message).join("|");

  useEffect(() => {
    if (signature && window.localStorage.getItem(DISMISS_KEY) === signature) {
      setDismissed(true);
    }
  }, [signature]);

  if (items.length === 0 || dismissed) return null;

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, signature);
    setDismissed(true);
  }

  function segment(item: AnnouncementItem, key: string) {
    const text = (
      <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-header text-[11.5px] font-medium text-white md:text-[0.8rem]">
        {truckIcon}
        {renderMessage(item.message)}
      </span>
    );
    return (
      <span key={key} className="inline-flex shrink-0 items-center pr-12">
        {item.linkUrl ? (
          <Link href={item.linkUrl} className="hover:underline">
            {text}
          </Link>
        ) : (
          text
        )}
      </span>
    );
  }

  return (
    <div className="relative flex h-10 items-center bg-header-green">
      {/* News-ticker marquee: content duplicated once (same recipe as
          CertificationRow's mobile auto-scroll) so `animate-marquee`'s
          0 → -50% translate loops seamlessly — a single announcement
          scrolls past on repeat, several scroll past back-to-back. */}
      <div className="mx-auto min-w-0 max-w-[1440px] flex-1 overflow-hidden px-8 md:px-6">
        <div className="flex w-max animate-marquee">
          {items.map((item, i) => segment(item, `a-${i}`))}
          {items.map((item, i) => segment(item, `b-${i}`))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={dismissLabel}
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white md:right-4"
      >
        {closeIcon}
      </button>
    </div>
  );
}
