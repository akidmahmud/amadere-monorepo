"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@amader/admin-ui";

type Tone = "danger" | "primary";
type Request =
  | {
      kind: "confirm";
      title: string;
      message?: React.ReactNode;
      confirmLabel: string;
      tone: Tone;
      icon?: string;
      resolve: (v: boolean) => void;
    }
  | {
      kind: "prompt";
      title: string;
      message?: React.ReactNode;
      confirmLabel: string;
      tone: Tone;
      icon?: string;
      placeholder?: string;
      defaultValue?: string;
      required?: boolean;
      resolve: (v: string | null) => void;
    };

// One open dialog at a time; a tiny store instead of a context so any
// handler (even outside React) can `await confirmDialog(...)`.
let current: (Request & { id: number }) | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const open = (r: Request) => {
  current = { ...r, id: ++seq } as Request & { id: number };
  emit();
};

/** Styled replacement for window.confirm. Resolves true on confirm. */
export function confirmDialog(o: {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  tone?: Tone;
  icon?: string;
}): Promise<boolean> {
  return new Promise((resolve) =>
    open({
      kind: "confirm",
      confirmLabel: o.confirmLabel ?? "Confirm",
      tone: o.tone ?? "primary",
      ...o,
      resolve,
    }),
  );
}

/** Styled replacement for window.prompt. Resolves the text, or null if cancelled. */
export function promptDialog(o: {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  tone?: Tone;
  icon?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}): Promise<string | null> {
  return new Promise((resolve) =>
    open({
      kind: "prompt",
      confirmLabel: o.confirmLabel ?? "OK",
      tone: o.tone ?? "primary",
      ...o,
      resolve,
    }),
  );
}

/** Mounted once (root layout). */
export function ConfirmDialogHost() {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
  if (!req) return null;
  return createPortal(<Dialog key={req.id} req={req} />, document.body);
}

function Dialog({ req }: { req: Request }) {
  const [text, setText] = useState(
    req.kind === "prompt" ? (req.defaultValue ?? "") : "",
  );
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = (ok: boolean) => {
    current = null;
    emit();
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok ? text : null);
  };
  const disabled = req.kind === "prompt" && !!req.required && !text.trim();
  useEffect(() => {
    (req.kind === "prompt" ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const danger = req.tone === "danger";
  const icon =
    req.icon ??
    (danger ? "delete" : req.kind === "prompt" ? "edit_note" : "help");

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => close(false)}
    >
      <form
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) close(true);
        }}
      >
        <div className="flex gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-emerald-50 text-[#1d7a46]"}`}
          >
            <Icon name={icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-lg font-bold text-gray-900">
              {req.title}
            </h2>
            {req.message && (
              <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {req.message}
              </div>
            )}
            {req.kind === "prompt" && (
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={req.placeholder}
                aria-label={req.title}
                className="mt-3 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
              />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-11 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            ref={okRef}
            type="submit"
            disabled={disabled}
            className={`h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#1d7a46] hover:bg-[#186a3c]"}`}
          >
            {req.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
