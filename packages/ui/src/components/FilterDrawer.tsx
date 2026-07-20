"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

// Mirrors MobileNavDrawer.tsx's exact Radix Dialog structure — same
// overlay/slide-in-from-left panel, used for collection pages' mobile filter
// panel instead of site nav. Kept controlled (open/onOpenChange) rather than
// a global store like the nav drawer since this is page-local state, not
// something other components need to trigger.
export function FilterDrawer({ open, onOpenChange, title, closeLabel, children }: FilterDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
