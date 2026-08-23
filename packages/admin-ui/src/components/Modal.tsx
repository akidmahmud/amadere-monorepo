"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** "dark" is a Net Profit / WPFOK-parity header variant — omit for the default light header used elsewhere. */
  tone?: "light" | "dark";
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// General-purpose centered overlay dialog with modern backdrop blur glassmorphism and smooth animations.
export function Modal({ open, onClose, title, children, className, tone = "light" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4 sm:p-6 transition-all duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-border/80 bg-surface shadow-2xl overflow-hidden transition-all duration-200",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border/60 px-6 py-4 bg-surface-2/50 backdrop-blur-sm",
            tone === "dark" && "border-transparent text-white",
          )}
          style={
            tone === "dark"
              ? { background: "linear-gradient(135deg, var(--wpfok-black, #0b0412) 0%, #1a0d2e 100%)" }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            {typeof title === "string" ? (
              <h2 className={cn("font-ui text-base font-bold tracking-tight", tone === "dark" ? "text-white" : "text-text")}>
                {title}
              </h2>
            ) : (
              title
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-all duration-150 active:scale-95",
              tone === "dark"
                ? "bg-white/10 text-white hover:bg-danger/80"
                : "text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border",
            )}
          >
            {closeIcon}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

