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

// Mirrors apps/admin's ToastProvider — mutation error handlers here (e.g. a
// homepage add-to-cart rejected for insufficient stock) were previously just
// unhandled promise rejections with nothing shown to the user.
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
      <div className="fixed bottom-[70px] right-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`rounded-lg px-4 py-3 font-ui text-sm font-semibold text-white shadow-lg ${
              t.variant === "error" ? "bg-red-600" : "bg-green"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
