"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";

const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const accountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </svg>
);

const trackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0">
    <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="18" cy="18" r="1.6" />
  </svg>
);

const globeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" />
  </svg>
);

export interface MobileNavDrawerNavItem {
  key: string;
  href: string;
  label: string;
  /** Optional small icon rendered before the label (matches Nav.tsx's per-item icon). */
  icon?: ReactNode;
}

export interface MobileNavDrawerProps {
  title: string;
  closeLabel: string;
  navItems: MobileNavDrawerNavItem[];
  accountHref?: string;
  accountLabel?: string;
  trackOrderHref: string;
  trackOrderLabel: string;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  linkComponent?: LinkComponent;
}

// Mirrors CartDrawer.tsx's exact Radix Dialog structure (same overlay/panel
// classes), mirrored to the left instead of the right so the two drawers
// never visually collide if somehow both were open.
export function MobileNavDrawer({
  title,
  closeLabel,
  navItems,
  accountHref,
  accountLabel,
  trackOrderHref,
  trackOrderLabel,
  localeSwitchLabel,
  onLocaleSwitch,
  linkComponent: Link = DefaultLink,
}: MobileNavDrawerProps) {
  const isOpen = useMobileNavDrawerStore((s) => s.isOpen);
  const close = useMobileNavDrawerStore((s) => s.close);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,40,25,.45)] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          className="fixed left-0 top-0 z-[70] flex h-full w-[320px] max-w-[85vw] flex-col bg-white"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between bg-green px-5 py-4 text-white">
            <Dialog.Title className="font-ui text-[15px] tracking-wide">{title.toUpperCase()}</Dialog.Title>
            <Dialog.Close aria-label={closeLabel} className="grid place-items-center">
              {closeIcon}
            </Dialog.Close>
          </div>

          <nav className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={close}
                className="flex items-center gap-2 border-b border-line py-3 font-ui text-sm font-medium text-ink hover:text-green"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {accountHref && accountLabel && (
                <Link
                  href={accountHref}
                  onClick={close}
                  className="flex items-center gap-1.5 font-ui text-sm font-medium text-ink hover:text-green"
                >
                  {accountIcon}
                  {accountLabel}
                </Link>
              )}
              <Link
                href={trackOrderHref}
                onClick={close}
                className="flex items-center gap-1.5 font-ui text-sm font-medium text-ink hover:text-green"
              >
                {trackIcon}
                {trackOrderLabel}
              </Link>
              <button
                type="button"
                onClick={() => {
                  onLocaleSwitch();
                  close();
                }}
                className="flex items-center gap-1.5 font-ui text-sm font-medium text-ink hover:text-green"
              >
                {globeIcon}
                {localeSwitchLabel}
              </button>
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
