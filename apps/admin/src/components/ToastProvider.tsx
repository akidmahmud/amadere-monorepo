"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  variant: "error" | "success";
}

interface ToastContextValue {
  push: (text: string, variant?: "error" | "success") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 0;

// Root-level provider (wraps everything in app/layout.tsx, same as
// QueryProvider) so any page can call useToast() without its own setup —
// mutation error handlers (e.g. a save rejected by backend validation)
// were previously just unhandled promise rejections with nothing shown to
// the user, per direct report on the product edit page.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((text: string, variant: "error" | "success" = "error") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, text, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`rounded-inner px-4 py-3 text-sm font-semibold text-white shadow-pop ${
              t.variant === "error" ? "bg-danger" : "bg-success"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
