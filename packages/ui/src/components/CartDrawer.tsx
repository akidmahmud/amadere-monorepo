"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode } from "react";
import { useCartDrawerStore } from "../stores/cartDrawerStore";
import { Button } from "./Button";

const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface CartDrawerProps {
  title: string;
  emptyLabel: string;
  checkoutLabel: string;
  closeLabel: string;
  subtotalLabel?: string;
  subtotal?: string;
  /** Line items — left empty in the F2 shell; F6 wires real cart data in. */
  children?: ReactNode;
  onCheckout?: () => void;
}

export function CartDrawer({
  title,
  emptyLabel,
  checkoutLabel,
  closeLabel,
  subtotalLabel,
  subtotal,
  children,
  onCheckout,
}: CartDrawerProps) {
  const isOpen = useCartDrawerStore((s) => s.isOpen);
  const close = useCartDrawerStore((s) => s.close);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,40,25,.45)] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          className="fixed right-0 top-0 z-[70] flex h-full w-[400px] max-w-[92vw] flex-col bg-white"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between bg-green px-5 py-4 text-white">
            <Dialog.Title className="font-ui text-[15px] tracking-wide">
              {title.toUpperCase()}
            </Dialog.Title>
            <Dialog.Close aria-label={closeLabel} className="grid place-items-center">
              {closeIcon}
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2.5">
            {children ?? (
              <p className="py-10 text-center font-body text-sm text-muted">
                {emptyLabel}
              </p>
            )}
          </div>

          {subtotal && (
            <div className="border-t border-line bg-white px-5 py-4">
              <div className="mb-3 flex justify-between font-ui font-semibold">
                <span>{subtotalLabel}</span>
                <span className="font-serif text-[17px] text-green">{subtotal}</span>
              </div>
              <Button variant="green" block onClick={onCheckout}>
                {checkoutLabel}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
