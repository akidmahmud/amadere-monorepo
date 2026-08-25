"use client";

import { useEffect, useState } from "react";
import { Icon } from "@amader/admin-ui";
import type { AdminOrder } from "@/hooks/useOrders";
import { NewOrderFormModern } from "@/components/orders/NewOrderFormModern";
import { NewOrderFormLegacy } from "@/components/orders/NewOrderForm.legacy";

export interface NewOrderFormProps {
  /** Preselects a customer (e.g. arriving from a customer's detail page). */
  initialCustomerId?: number | null;
  /** Called after the order is successfully created — caller decides what happens next. */
  onCreated: (order: AdminOrder) => void;
  /** Called when the staff member cancels out of the form. */
  onCancel: () => void;
}

const STORAGE_KEY = "amader_new_order_view_mode";

export function NewOrderForm(props: NewOrderFormProps) {
  const [viewMode, setViewMode] = useState<"modern" | "legacy">("modern");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "legacy" || saved === "modern") {
      setViewMode(saved);
    }
  }, []);

  function handleToggleMode(mode: "modern" | "legacy") {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
          <Icon name="tune" size={16} className="text-brand-500" />
          <span>Interface View:</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 p-1 text-xs">
          <button
            type="button"
            onClick={() => handleToggleMode("modern")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-bold transition-all ${
              viewMode === "modern"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-secondary hover:text-text"
            }`}
          >
            <span>✨ Modern Design</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode("legacy")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-bold transition-all ${
              viewMode === "legacy"
                ? "bg-secondary/20 text-text shadow-xs"
                : "text-secondary hover:text-text"
            }`}
          >
            <span>⏪ Classic View (Revert)</span>
          </button>
        </div>
      </div>

      {/* Render selected implementation */}
      {mounted && viewMode === "legacy" ? (
        <NewOrderFormLegacy {...props} />
      ) : (
        <NewOrderFormModern {...props} />
      )}
    </div>
  );
}
