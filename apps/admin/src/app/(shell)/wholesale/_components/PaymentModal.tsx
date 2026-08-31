"use client";

import { useState } from "react";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  useRecordWholesalePayment,
  type WholesaleOrder,
} from "@/hooks/useWholesale";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function PaymentModal({
  open,
  order,
  onClose,
}: {
  open: boolean;
  order: WholesaleOrder | null;
  onClose: () => void;
}) {
  const collect = useRecordWholesalePayment();
  const [amount, setAmount] = useState(order?.due ?? "0");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!order) return null;

  const {
    id: orderId,
    due,
    total,
    paid,
    customerName,
    customerPhone,
    orderNumber,
  } = order;
  const dueNum = Number(due || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payVal = Number(amount);
    if (isNaN(payVal) || payVal <= 0) {
      setErrorMsg("Please enter a valid payment amount greater than zero.");
      return;
    }

    try {
      await collect.mutateAsync({ id: orderId, amount });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Collect Payment — ${orderNumber}`}
      className="max-w-md"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <Icon name="payments" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-text">{customerName}</h4>
            <p className="text-xs text-secondary">
              {customerPhone ?? "No phone"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-surface-2 p-3 text-center">
          <div>
            <span className="block text-[11px] font-medium text-secondary">
              Total
            </span>
            <span className="num text-xs font-bold text-text">
              {money(total)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-secondary">
              Paid
            </span>
            <span className="num text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {money(paid)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-secondary">
              Due
            </span>
            <span className="num text-xs font-bold text-rose-600 dark:text-rose-400">
              {money(due)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-secondary">
            Payment Amount (৳) <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm font-bold text-muted">
              ৳
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={due}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} pl-7 font-semibold`}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAmount(String(dueNum))}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-surface-2 hover:text-text"
            >
              Full Due ({money(dueNum)})
            </button>
            {dueNum > 1 && (
              <button
                type="button"
                onClick={() => setAmount(String(Math.round(dueNum / 2)))}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-surface-2 hover:text-text"
              >
                Half ({money(Math.round(dueNum / 2))})
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={collect.isPending}>
            {collect.isPending ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
