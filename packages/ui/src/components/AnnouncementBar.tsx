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
  /** Only relevant with 2+ announcements — how often it auto-advances. */
  autoplayMs?: number;
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
// persisted value is the *current set* of messages (so rotating through
// several items and adding/removing/editing any of them all correctly
// reset the dismissal), not an actual hash algorithm; string equality does
// the same job here with no extra code.
export function AnnouncementBar({
  items,
  autoplayMs = 4000,
  dismissLabel = "Dismiss announcement",
  linkComponent: Link = DefaultLink,
}: AnnouncementBarProps) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const signature = items.map((item) => item.message).join("|");

  useEffect(() => {
    if (signature && window.localStorage.getItem(DISMISS_KEY) === signature) {
      setDismissed(true);
    }
  }, [signature]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), autoplayMs);
    return () => clearInterval(timer);
  }, [items.length, autoplayMs]);

  if (items.length === 0 || dismissed) return null;

  const current = items[Math.min(index, items.length - 1)];
  const content = (
    <span className="flex min-w-0 items-center justify-center gap-2 truncate font-header text-[11.5px] font-medium text-white md:whitespace-normal md:text-[0.8rem]">
      {truckIcon}
      <span className="truncate md:whitespace-normal">{renderMessage(current.message)}</span>
    </span>
  );

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, signature);
    setDismissed(true);
  }

  return (
    <div className="relative flex h-10 items-center bg-header-green">
      <div className="mx-auto min-w-0 max-w-[1440px] flex-1 overflow-hidden px-8 text-center md:px-6">
        {current.linkUrl ? (
          <Link href={current.linkUrl} className="hover:underline">
            {content}
          </Link>
        ) : (
          content
        )}
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
